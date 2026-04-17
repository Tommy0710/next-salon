const fs = require('fs');
const path = require('path');

const files = [
    "app/(frontend)/payroll/page.tsx",
    "app/(frontend)/services/page.tsx",
    "app/(frontend)/staff/page.tsx",
    "app/(frontend)/reports/financial/page.tsx",
    "app/(frontend)/expenses/page.tsx",
    "app/(frontend)/pos/page.tsx",
    "app/(frontend)/appointments/page.tsx",
    "app/(frontend)/invoices/page.tsx",
    "app/(frontend)/purchases/create/page.tsx",
    "app/(frontend)/appointments/calendar/page.tsx",
    "app/(frontend)/products/page.tsx",
    "app/(frontend)/purchases/page.tsx",
    "app/(frontend)/purchases/[id]/page.tsx",
    "app/(frontend)/customers/page.tsx"
];

let filesModified = 0;

for (const relPath of files) {
    const filePath = path.join(__dirname, relPath);
    if (!fs.existsSync(filePath)) continue;

    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // Simple cases like {settings.symbol}{staff.salary?.toLocaleString() || 0}
    // and {settings.symbol}{payroll.baseSalary.toLocaleString()}
    
    // Replace {settings.symbol}{something.toLocaleString()} with {formatCurrency(something)}
    content = content.replace(/\{settings\.symbol\}\{([a-zA-Z0-9_.\?]+)\.toLocaleString\(\)\}/g, "{formatCurrency($1)}");
    content = content.replace(/\{settings\.symbol\}\{([a-zA-Z0-9_.\?]+)\.toLocaleString\(\)\s*\|\|\s*0\}/g, "{formatCurrency($1 || 0)}");
    
    // Replace .toFixed(2) variants
    content = content.replace(/\{settings\.symbol\}\{([a-zA-Z0-9_.\?]+(?: \as any\))?(\?.toFixed\(2\)|\.toFixed\(2\)))\}/g, (match, p1) => {
        let clean = p1.replace(/\??\.toFixed\(2\)$/, '');
        clean = clean.replace(/ \(as any\)$/, '');
        return `{formatCurrency(${clean})}`;
    });

    // Replace {settings.symbol}{val.toLocaleString(...)} in reports/financial/page.tsx
    content = content.replace(/\$\{settings\.symbol\}\$\{val\.toLocaleString[^}]+\}/g, "${formatCurrency(val)}");
    
    // Complex arithmetic in appointments/page.tsx etc
    content = content.replace(/\{settings\.symbol\}\{\(\((.*?)\) - \((.*?)\)\)\.toFixed\(2\)\}/g, "{formatCurrency($1 - ($2))}");

    // Add import if not present and content actually changed
    if (content !== originalContent) {
        if (!content.includes('formatCurrency(val)') && !content.includes('formatCurrency(')) continue; // Double check

        if (!content.includes('import { formatCurrency }')) {
            // Find last import
            const importRegex = /^import .+ from .+;/gm;
            let lastMatch;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                lastMatch = match;
            }
            if (lastMatch) {
                const insertPos = lastMatch.index + lastMatch[0].length + 1;
                content = content.slice(0, insertPos) + 'import { formatCurrency } from "@/lib/currency";\n' + content.slice(insertPos);
            }
        }
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Modified ${relPath}`);
        filesModified++;
    }
}
console.log(`Finished, modified ${filesModified} files.`);
