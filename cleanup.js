import fs from 'fs';

const removeUnused = (file, tokens) => {
    let content = fs.readFileSync(file, 'utf8');
    tokens.forEach(token => {
        // Match import { ..., Token, ... }
        const importRegex = new RegExp(`(\\s*,?\\s*\\b${token}\\b\\s*,?\\s*)`, 'g');
        content = content.replace(importRegex, (match) => {
            // Check if it's inside an import block
            return match.includes(',') ? (match.startsWith(',') ? '' : (match.endsWith(',') ? '' : '')) : ''; 
        });
    });
    // Cleanup empty imports
    content = content.replace(/import\s*\{\s*\}\s*from\s*['"][^'"]+['"];?\n?/g, '');
    fs.writeFileSync(file, content);
};

// LevelUp
removeUnused('./components/LevelUp.tsx', ['submitLevelUp', 'Edit2', 'ArrowRight', 'HelpCircle', 'Home', 'Car', 'Baby', 'Package', 'FolderPlus', 'Info', 'User', 'ChevronDown', 'ChevronUp', 'Briefcase', 'PiggyBank', 'CreditCard']);

// Player
removeUnused('./components/Player.tsx', ['Zap', 'Star', 'TrendingUp']);

// Sidebar
removeUnused('./components/Sidebar.tsx', ['Menu']);

// Retirement
removeUnused('./components/Retirement.tsx', ['fetchFinancialHealth']);

// LiabilitiesStep
removeUnused('./components/kyc/steps/LiabilitiesStep.tsx', ['Home', 'Car', 'DebouncedTextInput']);

// PDPAStep
// pdpaAccepted, t
let pdpa = fs.readFileSync('./components/kyc/steps/PDPAStep.tsx', 'utf8');
pdpa = pdpa.replace(/const { pdpaAccepted } = formData;/, '');
pdpa = pdpa.replace(/const { t } = useLanguage\(\);/, '');
fs.writeFileSync('./components/kyc/steps/PDPAStep.tsx', pdpa);

// ReviewSummaryStep
let rs = fs.readFileSync('./components/kyc/steps/ReviewSummaryStep.tsx', 'utf8');
rs = rs.replace(/\[key, items\]/g, '[, items]');
fs.writeFileSync('./components/kyc/steps/ReviewSummaryStep.tsx', rs);

// Player
let player = fs.readFileSync('./components/Player.tsx', 'utf8');
player = player.replace(/const emergencyTarget = .*/, '');
fs.writeFileSync('./components/Player.tsx', player);

// LevelUp
let levelUp = fs.readFileSync('./components/LevelUp.tsx', 'utf8');
levelUp = levelUp.replace(/type\s*,?\s*/g, '');
fs.writeFileSync('./components/LevelUp.tsx', levelUp);

console.log('Cleanup done');
