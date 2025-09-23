---
name: setup-project
description: Initialize the Leadership Values Card Sort project with all dependencies
match: setup|init|start project
---

Set up the complete project structure for the Leadership Values Card Sort app:

1. Initialize Next.js with TypeScript:
```bash
npx create-next-app@latest leadership-values-card-sort --typescript --tailwind --app --no-src-dir
cd leadership-values-card-sort
```

2. Install core dependencies:
```bash
# Core libraries
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install framer-motion zustand ably react-query
npm install html2canvas jspdf

# Dev dependencies  
npm install -D @types/node playwright @playwright/test
npm install -D @types/react @types/react-dom
```

3. Create project structure:
```bash
mkdir -p app/api app/canvas components/{cards,canvas,collaboration,ui}
mkdir -p hooks/{collaboration,dnd} lib/{ably,game-logic,export}
mkdir -p state/{local,shared} data/csv tests/e2e
mkdir -p public/assets .claude/{agents,commands,hooks}
```

4. Set up environment variables (.env.local):
```
NEXT_PUBLIC_ABLY_KEY=your-ably-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

5. Create initial CSV file (data/csv/professional.csv) with 40 leadership values

6. Initialize git repository with .gitignore including:
```
.env.local
.claude/local/
node_modules/
.next/
```

---