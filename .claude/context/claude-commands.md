# .claude/commands/setup-project.md

```yaml
name: setup-project
description: Initialize the Leadership Values Card Sort project with all dependencies
match: setup|init|start project
```

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

# .claude/commands/run-multiuser.md

```yaml
name: run-multiuser
description: Launch multiple browser instances to test real-time collaboration
match: multiuser|multi-user|test collaboration
```

Launch a multi-user testing environment:

1. Start the development server:
```bash
npm run dev
```

2. Open 3 browser instances with different profiles:
```bash
# Terminal 1 - User A (Facilitator)
npx playwright codegen http://localhost:3000 --viewport-size=1920,1080 --color-scheme=light

# Terminal 2 - User B (Participant)
npx playwright codegen http://localhost:3000 --viewport-size=1920,1080 --color-scheme=light --user-data-dir=/tmp/user-b

# Terminal 3 - User C (Observer)  
npx playwright codegen http://localhost:3000 --viewport-size=1920,1080 --color-scheme=light --user-data-dir=/tmp/user-c
```

3. Create test session:
- User A: Click settings → generates code "ABC123"
- User A: Enter name "Alice" → Join
- User B: Enter code "ABC123", name "Bob" → Join
- User C: Enter code "ABC123", name "Charlie" → Join

4. Test synchronization:
- Have users sort cards simultaneously
- Test reveal functionality at Step 2
- Verify viewer presence when viewing others' arrangements

This helps identify race conditions and sync issues.

---

# .claude/commands/debug-websocket.md

```yaml
name: debug-websocket
description: Debug Ably WebSocket connections and message flow
match: debug ws|websocket|ably issues|sync problems
```

Debug WebSocket/Ably connection issues:

1. Enable Ably debug logging:
```javascript
// In lib/ably/client.ts
const ably = new Ably.Realtime({
  key: process.env.NEXT_PUBLIC_ABLY_KEY,
  logLevel: 4, // Maximum verbosity
  echoMessages: true, // See own messages
});
```

2. Add connection state monitoring:
```javascript
ably.connection.on('connected', () => console.log('✅ Ably connected'));
ably.connection.on('disconnected', () => console.log('❌ Ably disconnected'));
ably.connection.on('suspended', () => console.log('⚠️ Ably suspended'));
```

3. Monitor specific channels:
```javascript
const channel = ably.channels.get(`session:${sessionCode}:presence`);
channel.subscribe((message) => {
  console.log('Message received:', {
    name: message.name,
    data: message.data,
    timestamp: new Date().toISOString()
  });
});
```

4. Check presence set:
```javascript
channel.presence.get((err, members) => {
  console.log('Current members:', members?.map(m => m.clientId));
});
```

5. Use Ably's debug dashboard: https://ably.com/accounts/[your-account]/apps/[app-id]/app_stats

Common issues to check:
- API key permissions (publish, subscribe, presence)
- Channel naming consistency
- Message size limits (65KB)
- Connection limits per key

---

# .claude/commands/analyze-performance.md

```yaml
name: analyze-performance
description: Profile drag-drop performance and animation frames
match: performance|perf|slow|lag|fps
```

Analyze and optimize performance issues:

1. Enable React DevTools Profiler:
```javascript
// Wrap problem area in Profiler
import { Profiler } from 'react';

<Profiler id="CardDrag" onRender={onRenderCallback}>
  <DraggableCard />
</Profiler>
```

2. Check frame rate during drag:
```javascript
// Add to drag handler
let lastTime = performance.now();
const checkFPS = () => {
  const now = performance.now();
  const fps = 1000 / (now - lastTime);
  if (fps < 55) console.warn(`Low FPS: ${fps.toFixed(1)}`);
  lastTime = now;
};
```

3. Measure animation performance:
```javascript
// In Card component
const measureFlip = () => {
  performance.mark('flip-start');
  // ... animation code ...
  performance.mark('flip-end');
  performance.measure('flip', 'flip-start', 'flip-end');
  
  const measure = performance.getEntriesByName('flip')[0];
  if (measure.duration > 300) {
    console.warn(`Slow flip: ${measure.duration}ms`);
  }
};
```

4. Profile WebSocket message frequency:
```javascript
const messageCounter = new Map();
channel.subscribe((msg) => {
  const count = messageCounter.get(msg.name) || 0;
  messageCounter.set(msg.name, count + 1);
  
  // Log every second
  setTimeout(() => {
    console.log('Message rates:', Object.fromEntries(messageCounter));
    messageCounter.clear();
  }, 1000);
});
```

5. Run Lighthouse CI:
```bash
npm install -D @lhci/cli
npx lhci autorun
```

Key metrics to maintain:
- First Contentful Paint < 1s
- Time to Interactive < 2s  
- Drag operations at 60fps
- WebSocket messages < 50/second

---

# .claude/commands/export-snapshot.md

```yaml
name: export-snapshot  
description: Test snapshot export functionality in multiple formats
match: export|snapshot|pdf|download
```

Test and debug the snapshot export feature:

1. Basic implementation:
```javascript
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const exportSnapshot = async (format: 'png' | 'jpg' | 'pdf') => {
  const element = document.getElementById('canvas-area');
  
  const canvas = await html2canvas(element, {
    scale: 2, // Higher quality
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });
  
  if (format === 'pdf') {
    const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 10, 10, 277, 190);
    pdf.setProperties({
      title: `Leadership Values - ${userName}`,
      subject: `Session: ${sessionCode}`,
      creator: 'Leadership Values Card Sort',
    });
    pdf.save(`values-${sessionCode}-${Date.now()}.pdf`);
  } else {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `values-${sessionCode}-${Date.now()}.${format}`;
      a.click();
    }, `image/${format}`, 0.95);
  }
};
```

2. Add metadata overlay:
```javascript
// Before capture, temporarily add overlay
const overlay = document.createElement('div');
overlay.innerHTML = `
  <div class="snapshot-header">
    <h2>${userName}'s Top ${cardCount} Leadership Values</h2>
    <p>Session: ${sessionCode} | ${new Date().toLocaleDateString()}</p>
  </div>
`;
element.prepend(overlay);
// Capture
// Remove overlay
```

3. Test different scenarios:
- Export during drag (should complete drop first)
- Export with 0, 3, 8 cards
- Export on slow connections
- Export very long card descriptions

4. Validate output quality at different zoom levels