const fs = require('fs');
const files = fs.readdirSync('components/kyc/steps').filter(f => f.endsWith('.tsx'));
files.forEach(f => {
    let p = 'components/kyc/steps/' + f;
    let content = fs.readFileSync(p, 'utf8');
    let newContent = content.replace(/from '\.\.\/\.\.\/types'/g, "from '../../../types'");
    if (content !== newContent) {
        fs.writeFileSync(p, newContent);
        console.log(`Updated ${p}`);
    }
});
