# PDF 表单填写 + Google Drive 上传：完整指南

记录从 0 到 1 实现「客户在线填表 → 自动填入官方 PDF → 自动上传到 Google Drive」的整个流程。
下次做类似项目可直接照抄。

---

## 一、架构总览

```
客户浏览器                Vercel Serverless                Google Cloud
─────────                ─────────────────                ──────────────
React 表单     ───► 客户端用 pdf-lib 填 PDF
                       │
                       ▼
              PDF 预览 + 确认                    
                       │
                       ▼
              base64 POST 到 /api/submit-...  ───► Vercel OIDC token
                                                          │
                                                          ▼
                                                  GCP STS 换 federated token
                                                          │
                                                          ▼
                                                  IAM 假冒 service account
                                                          │
                                                          ▼
                                                  Drive API multipart upload
                                                          │
                                                          ▼
                                                  Shared Drive 文件夹
```

**关键点：** 客户端填 PDF（pdf-lib），不是后端。后端只做 Drive 上传。

---

## 二、PDF 坐标系（最容易踩坑）

### 两个不同的坐标系

| 工具 | 原点 | y 增长方向 | 用途 |
|---|---|---|---|
| **pdfplumber** (Python) | 左上角 | 向下 | 提取 PDF 中每个字符/单词的位置 |
| **pdf-lib** (JS) | 左下角 | 向上 | 往 PDF 上写字 |

### 转换公式

A4 页面高度 H = 841.92 pt（pdfplumber 给的就是这个）

```typescript
const H = 841.92;
function y(top: number) { return H - top; }  // pdfplumber top → pdf-lib y
```

### 找坐标的标准流程

1. **用 pdfplumber 提取空白模板的字符位置：**
```python
import pdfplumber
with pdfplumber.open('form.pdf') as pdf:
    for ch in pdf.pages[1].chars:  # 第 2 页
        print(f'top={ch["top"]:.1f} x0={ch["x0"]:.1f} text={repr(ch["text"])}')
```

2. **找到 label 的 top 值，例如 "Registration No." 在 top=76.9**

3. **在 pdf-lib 中放文字：**
```typescript
// 文字基线略高于 label top（因为字体 ascent）
text(p2, registrationNo, 100, y(79));  // top=79 → 比 label 低 ~2pt
```

### 常见对齐规律（empirically）

- **inline 字段**（label 在左，值在右同一行）：文字 top = label top − 4pt（视觉上对齐）
- **block 字段**（label 在上，值在下一行）：文字 top = label_bottom + 8~10pt
- **多行 label**（如 "Name of Corporation\n(as per Company Registration)"）：用 label 最后一行的 top + ~10pt

### 调试技巧

写完一版后导出 PDF，再用 pdfplumber 提取**填进去的字符** font=Helvetica，对比 label 位置：
```python
for ch in pdf.pages[1].chars:
    if 'Helvetica' in ch['fontname']:  # 我们用 Helvetica 填，模板用 Arial
        print(f'top={ch["top"]} x0={ch["x0"]} text={ch["text"]}')
```

---

## 三、Vercel + GCP Workload Identity Federation（无 key）

这是这次最大的坑。我们想：从 Vercel 上传到 Google Drive，但不能用 SA JSON key（公司政策禁止）。
解决方案：Workload Identity Federation（WIF）—— Vercel 提供 OIDC token，GCP 验证后换 access token。

### 配置步骤（按顺序）

#### 1. 启用 Google Drive API
```
https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=<PROJECT_NUMBER>
```
点 ENABLE。

#### 2. 创建 Workload Identity Pool
GCP Console → IAM & Admin → Workload Identity Federation → CREATE POOL
- ID 自定（如 `vercel-pool`）

#### 3. 添加 OIDC Provider
在 pool 里 ADD PROVIDER → OIDC：
- **Issuer URL**: `https://oidc.vercel.com/<vercel-team-slug>`
  - ⚠️ **包含 team slug**，不是 `https://oidc.vercel.com`
  - team slug 在 Vercel team URL 里能看到（如 `leon-lees-projects-3b22af0e`）
- **Audiences**: 选 **Allowed audiences**，输入 `https://vercel.com/<vercel-team-slug>`
  - ⚠️ Vercel OIDC token 的 `aud` claim 默认是这个值
- **Attribute mapping**: `google.subject = assertion.sub`

#### 4. 创建 Service Account
IAM → Service Accounts → CREATE
- 不需要分配项目级 role

#### 5. 让 WIF 身份能假冒 SA
SA 详情页 → PERMISSIONS → GRANT ACCESS：
- **Principal**: `principalSet://iam.googleapis.com/projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<POOL_ID>/*`
  - ⚠️ `principalSet://` 不是 `principal://`，结尾 `/*` 表示 pool 内所有身份
- **Role**: `Service Account Token Creator` (`roles/iam.serviceAccountTokenCreator`)

#### 6. 创建 Shared Drive（不能用普通 folder！）
- 需要 **Google Workspace** 账号
- Drive → Shared drives → New
- 把 SA email 加为 **Content manager**
- 复制 Shared Drive（或里面子文件夹）的 ID

⚠️ **关键概念：** SA 没有 Drive 存储配额。普通 Drive folder 里 SA 上传会失败（`storageQuotaExceeded`）。
只有 Shared Drive 不依赖单一用户配额。

#### 7. Vercel 环境变量
```
GOOGLE_WIF_PROVIDER          = projects/<NUM>/locations/global/workloadIdentityPools/<POOL>/providers/<PROVIDER>
GOOGLE_SERVICE_ACCOUNT_EMAIL = xxx@xxx.iam.gserviceaccount.com
GOOGLE_DRIVE_FOLDER_ID       = <Shared Drive folder ID>
```
**注意 scope：** Preview/Production 都要设。改完 env 必须 **redeploy**。

---

## 四、API 代码模板

`api/submit-form.js`（关键点都注释了）：

```javascript
import { getVercelOidcToken } from '@vercel/functions/oidc';

export default async function handler(req, res) {
  // CORS + method 检查...
  const { pdfBase64, fileName } = req.body;

  const accessToken = await getGoogleAccessToken();

  // multipart upload — 注意 supportsAllDrives=true（Shared Drive 必需）
  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body, // metadata + PDF bytes
    }
  );
}

async function getGoogleAccessToken() {
  const provider = process.env.GOOGLE_WIF_PROVIDER;
  // ⚠️ 不要传 audience 给 getVercelOidcToken —— 参数被忽略，Vercel 的 audience 是固定的
  const oidcToken = await getVercelOidcToken();

  // Step 1: STS 换 federated token
  const stsRes = await fetch('https://sts.googleapis.com/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audience: `//iam.googleapis.com/${provider}`,
      grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
      subjectToken: oidcToken,
      // ⚠️ 必须 cloud-platform（不是 drive.file）—— 后面要调 iamcredentials API
      scope: 'https://www.googleapis.com/auth/cloud-platform',
    }),
  });
  const { access_token: federatedToken } = await stsRes.json();

  // Step 2: 假冒 SA 拿最终 access token（这一步才限定 Drive scope）
  const impRes = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${federatedToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/drive.file'] }),
    }
  );
  const { accessToken } = await impRes.json();
  return accessToken;
}
```

---

## 五、踩过的坑（按顺序）

| # | 报错 | 原因 | 修复 |
|---|---|---|---|
| 1 | `GOOGLE_WIF_PROVIDER not configured` | env var 没设到 Preview | Vercel env 同时勾选 Preview |
| 2 | `issuer in ID Token ... does not match` | Provider Issuer URL 漏了 team slug | 改成 `https://oidc.vercel.com/<team-slug>` |
| 3 | `audience in ID Token ... does not match` | 没设 Allowed audiences | Provider 加 `https://vercel.com/<team-slug>` 为 allowed audience |
| 4 | `ACCESS_TOKEN_SCOPE_INSUFFICIENT` | STS scope 太窄，不能调 IAMCredentials | STS scope 改 `cloud-platform`，SA 假冒时再窄到 `drive.file` |
| 5 | `iam.serviceAccounts.getAccessToken denied` | WIF 身份没 Token Creator role | SA 加 `principalSet://...` 为 Token Creator |
| 6 | `Drive API not enabled` | API 没启用 | Console 启用 Drive API |
| 7 | `storageQuotaExceeded` | SA 没存储配额 | 用 Shared Drive（Workspace 账号）+ `supportsAllDrives=true` |

---

## 六、客户端 PDF 表单的 React 模式

多步表单 + PDF 预览 + 上传的标准结构：

```tsx
// 步骤状态
const [step, setStep] = useState(1);
const [data, setData] = useState<FormData>(initial);
const [pdfBlobUrl, setPdfBlobUrl] = useState<string>();
const [pdfBase64, setPdfBase64] = useState<string>();

// 生成预览
async function handleGeneratePreview() {
  const bytes = await fillPdf(data);                        // pdf-lib 填
  const blob = new Blob([bytes], { type: 'application/pdf' });
  setPdfBlobUrl(URL.createObjectURL(blob));
  setPdfBase64(arrayBufferToBase64(bytes));
  setStep(REVIEW_STEP);
}

// 提交
async function handleSubmit() {
  const res = await fetch('/api/submit-form', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfBase64, fileName: makeName(data) }),
  });
}

// 预览组件
<object data={pdfBlobUrl} type="application/pdf" width="100%" height="600" />
```

**签名捕获 + 自动填日期：**
```tsx
<SignaturePad onSignature={(url) => {
  const today = new Date().toISOString().slice(0, 10);
  set({ signatureDataUrl: url, signatureDate: data.signatureDate || today });
}}/>
```

---

## 七、Checklist（下次按这个走）

### 准备阶段
- [ ] 拿到官方 PDF 模板
- [ ] 用 pdfplumber 提取每个 label 的 (top, x0)
- [ ] 列出所有需要填的字段，建 TypeScript interface

### 实现阶段
- [ ] 写 `fillPdf(data): Uint8Array`（pdf-lib）
- [ ] 写多步 React 表单 + 校验
- [ ] PDF 预览步骤（`<object>` + blob URL）
- [ ] 写 `/api/submit-*` endpoint

### GCP 配置
- [ ] 启用 Drive API
- [ ] 创建 Workload Identity Pool
- [ ] 创建 OIDC Provider（issuer 含 team slug，audience 是 vercel.com/<slug>）
- [ ] 创建 Service Account（无项目 role）
- [ ] SA grant `principalSet://.../*` Token Creator
- [ ] 创建 Shared Drive，加 SA 为 Content manager
- [ ] 拿 Shared Drive folder ID

### Vercel 配置
- [ ] 安装 `@vercel/functions`
- [ ] 设 3 个 env vars（Preview + Production 都要）
- [ ] Deploy

### 测试阶段
- [ ] 表单完整流程
- [ ] PDF 预览正确
- [ ] Submit 到 Drive 成功
- [ ] 检查 PDF 对齐（用 pdfplumber 比对填的字符位置）

---

## 八、参考链接

- pdf-lib: https://pdf-lib.js.org/
- pdfplumber: https://github.com/jsvine/pdfplumber
- Vercel OIDC: https://vercel.com/docs/security/secure-backend-access/oidc
- GCP WIF: https://cloud.google.com/iam/docs/workload-identity-federation
- Drive API multipart upload: https://developers.google.com/drive/api/guides/manage-uploads#multipart
- Shared Drives: https://developers.google.com/drive/api/guides/about-shareddrives
