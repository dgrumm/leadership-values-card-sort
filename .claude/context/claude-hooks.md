# .claude/hooks/pre-commit.md

```yaml
name: pre-commit
description: Runs before any code changes to ensure quality
trigger: before_commit
```

Before committing changes, ensure:

1. **Type Safety**: No TypeScript errors
```bash
npx tsc --noEmit
```

2. **Linting**: Code follows standards
```bash
npx eslint . --fix
```

3. **Critical Tests**: Core functionality works
```bash
npm run test:e2e -- --grep="@critical"
```

4. **Performance**: Check bundle size
```bash
npx next build
npx @next/bundle-analyzer
```

5. **Security**: No exposed keys
```bash
grep -r "ABLY_KEY\|localhost:3000" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules
```

Abort commit if any check fails.

---

# .claude/hooks/on-error.md

```yaml
name: on-error
description: Handles errors during development
trigger: on_error
```

When encountering an error:

1. **For TypeScript errors**: Check if it's a missing type definition
```bash
npm install -D @types/[package-name]
```

2. **For Drag-Drop issues**: Verify DndContext wrapper
```javascript
// App must be wrapped in DndContext
<DndContext onDragEnd={handleDragEnd}>
  {children}
</DndContext>
```

3. **For WebSocket errors**: Check Ably connection
```javascript
console.log('Ably state:', ably.connection.state);
console.log('Ably error:', ably.connection.errorReason);
```

4. **For Animation glitches**: Verify Framer Motion setup
```javascript
// Cards need layoutId for smooth transitions
<motion.div layoutId={`card-${card.id}`}>
```

5. **For State sync issues**: Check Zustand devtools
```javascript
window.__ZUSTAND_DEVTOOLS__ = true;
```

---

# .claude/.mcp.json

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/mcp-playwright"],
      "description": "Playwright automation for E2E testing drag-drop and multi-user interactions"
    },
    "context7": {
      "command": "npx", 
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {
        "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}"
      },
      "description": "Real-time documentation for Next.js, React, Ably, and dnd-kit"
    },
    "memory-bank": {
      "command": "npx",
      "args": ["-y", "@alioshr/memory-bank-mcp"],
      "env": {
        "MEMORY_BANK_PATH": "./.claude/memory"
      },
      "description": "Persistent memory for design decisions and bug patterns"
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@github/github-mcp-server"],  
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      },
      "description": "GitHub integration for issue tracking and PR management"
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@crystaldba/postgres-mcp"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      },
      "description": "Optional: Database access if you add persistence layer"
    }
  }
}
```

---

# .claude/memory/project-decisions.md

Initial decisions to remember:

## Architecture Choices
- **Next.js over Vite**: Chosen for integrated API routes and better session management
- **@dnd-kit over react-beautiful-dnd**: Better performance and accessibility
- **Ably over raw WebSockets**: Managed service with presence, history, and reliability
- **Zustand over Redux**: Simpler for local state, Ably handles sync

## Design Patterns
- **Optimistic UI**: All drag operations update locally first, then sync
- **Throttling**: 50ms for cursor, 200ms for card positions
- **Session codes**: 6 uppercase alphanumeric (A-Z, 0-9)
- **Animations**: All use Framer Motion with specific timings from PRD

## Known Constraints
- Must support exactly 8 cards in Top 8, exactly 3 in Top 3
- No localStorage/sessionStorage in artifacts (memory only)
- Desktop-only: Optimized for 1920x1080
- 60-minute session timeout with 55-minute warning

## Testing Scenarios
- Solo flow: Login → Sort 40 cards → Top 8 → Top 3 → Export
- Multi-user: 5 users simultaneously sorting and revealing
- Constraint validation: Exceeding pile limits triggers bounce
- Network issues: Disconnection and reconnection handling

## Performance Targets
- Card drag at 60fps minimum
- WebSocket sync within 200ms
- Page load under 2 seconds
- Support 50 concurrent users per session

---

# .claude/local/.gitignore

# This file should be in your .gitignore
# Used for personal preferences not shared with team

---

# .claude/local/preferences.md

```yaml
name: local-preferences
description: Personal development preferences (git-ignored)
```

## My Preferences
- Use console.log for debugging (remove before commit)
- Prefer async/await over .then() chains
- Comment complex animations with timing notes
- Use data-testid attributes for E2E selectors

## Local Testing Accounts
- Test User A: "Alice" (facilitator)
- Test User B: "Bob" (participant)  
- Test User C: "Charlie" (observer)
- Test Session: "TEST99"

## Development URLs
- Local: http://localhost:3000
- Ably Dashboard: https://ably.com/accounts/[my-account]
- Staging: [my-staging-url]

## Personal Aliases
```bash
alias lvc="cd ~/projects/leadership-values-card-sort"
alias test-multi="npm run test:e2e -- --headed --workers=3"
alias reset-db="rm -rf .next && npm run dev"
```