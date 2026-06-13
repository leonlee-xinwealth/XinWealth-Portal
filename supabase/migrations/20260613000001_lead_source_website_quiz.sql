-- 为网站投资力自测漏斗新增线索来源
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'website_quiz';
