# 🂱 Leadership Values Card Sort

An interactive card-sorting exercise for identifying core leadership values through progressive reduction (40→8→3 cards). Built with real-time collaboration features for team workshops and individual reflection.

## 🎯 Overview

This application guides users through a structured values identification process:

1. **Step 1**: Sort value cards deck into "More Important" and "Less Important" piles
2. **Step 2**: Narrow down to your "Top 8" most important values
3. **Step 3**: Select your final "Top 3" core leadership values

Perfect for leadership development workshops, team building exercises, and personal reflection.

## ✨ Features

- **Real-time Collaboration**: Multiple participants can join sessions and see each other's progress
- **Drag & Drop Interface**: Intuitive card sorting with smooth animations
- **Progressive Reduction**: Structured 3-step process for focused decision-making
- **Export Capabilities**: Generate PDF reports of final selections
- **Semi-Responsive Design**: Works on desktop and tablet... but doesn't really work for mobile device form facctor
- **Accessibility**: Full keyboard navigation and screen reader support

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Ably account for real-time features

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd leadership-values-card-sort

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` to start using the application.

### Environment Setup

Create a `.env.local` file with required environment variables:

```bash
# Ably configuration for real-time features
NEXT_PUBLIC_ABLY_KEY=your_ably_key_here

# Optional: Enable debug logging
NODE_ENV=development
```

## 🎮 How to Use

### Creating a Session

1. Visit the homepage
2. Enter your name and create a new session
3. Share the session code with other participants (optional)

### Individual Use

- Work through the 3 steps at your own pace
- Cards are automatically saved as you progress
- Export your final results as a PDF for future reflection or sharing with others

### Collaborative Sessions

- Multiple people can join the same session
- See real-time presence indicators
- Each participant maintains their own card selections
- Participants can choose to reveal their cards to others, or keep them private
- Perfect for team workshops and group discussions

## 🛠 Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **Styling**: Tailwind CSS + Framer Motion (animations)
- **Real-time**: Ably WebSockets for collaboration
- **State Management**: Zustand (local state), Ably (sync)
- **Drag & Drop**: @dnd-kit/sortable
- **Export**: html2canvas, jsPDF
- **Testing**: Jest (unit), Playwright (E2E)

## 📁 Project Structure

```
/app                 # Next.js app directory
  /api              # Session management, CSV loading
  /canvas           # Main sorting interface
/components
  /cards            # Card, Deck, Pile components  
  /canvas           # DragLayer, DropZones
  /collaboration    # ParticipantList, PresenceCursors
  /ui               # Buttons, Modals, Progress
/hooks
  /collaboration    # useAbly, usePresence, useSession
  /stores           # Session-scoped state management
/lib
  /game-logic       # Shuffle, validation, step transitions
  /export           # PDF generation
/data
  /csv              # Values card definitions
```

## 🧪 Testing

```bash
# Run all tests
npm run test:all

# Unit tests only
npm run test:unit

# E2E tests only
npm run test:e2e

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

## 🃏Card Decks

- **Development**: Humorous tech-focused values for testing
- **Professional**: Standard leadership values for business contexts
- **Extended**: Comprehensive set with additional values

### Custom Card Decks

Add your own values by creating a CSV file in `/data/csv/`:

```csv
value_name,description
Innovation,"The drive to create new solutions and approaches"
Integrity,"Commitment to honesty and strong moral principles"
```

Then load it with:
```bash
npm run build:csv
```

# API Documentation

## Session Management
- `POST /api/sessions` - Create new session
- `GET /api/sessions/:code` - Join existing session
- `DELETE /api/sessions/:code` - End session

## Real-time Events (Ably)
- Channel: `session:${sessionCode}`
- Events: `card-moved`, `participant-joined`, `step-completed`, `reveal-toggled`

## Error Codes
- `SESSION_NOT_FOUND` - Invalid session code
- `SESSION_FULL` - Maximum participants reached
- `INVALID_PARTICIPANT` - Participant validation failed


## 🚀 Deployment Guide

### Build for Production

```bash
npm run build
npm start
```

## Environment Setup
```bash
# Required
NODE_ENV=production
ABLY_API_KEY=your_ably_key_here
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Production Checklist
- [ ] Environment variables configured
- [ ] SSL certificate installed

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm run test:all`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Guidelines

- All changes must pass unit and E2E tests
- Follow the existing code style and patterns
- Add tests for new features
- Update documentation as needed

## 🤖 Development Acknowledgments

This project serves as both a functional leadership development tool and a **case study in agentic AI development practices**. It was built with extensive assistance from AI agents to evaluate and improve human-AI collaboration workflows.

### AI Development Tools Used:

- **[Claude](https://claude.ai/)**: Product requirements documentation, specificiation writing
- **[Claude Code](https://www.anthropic.com/claude-code)**: Planning, primary development assistant for architecture, implementation and testing
- **[GitHub Copilot](https://github.com/features/copilot)**: Code completion and suggestion assistance
- **[Augment Code](https://augmentcode.com/)**: Later entrant into my workflow, started as cdde review, documentation, and problem-solving support... and architecture refactoring

### Agentic Development Artifacts:
The repository includes comprehensive supporting materials designed to guide AI agents through complex development tasks:

- **`.claude/` directory**: Agent context, workflows, and decision templates
- **`/specs/` directory**: Detailed project specifications and acceptance criteria
- **Project PRD**: Product requirements and architectural decisions
- **Multi-agent workflows**: Coordinated processes for testing, debugging, and feature development

### Research & Learning Objectives:
- Evaluate effectiveness of structured agent guidance materials
- Test multi-agent coordination for complex software projects
- Develop best practices for human-AI collaborative development
- Create reusable patterns for agentic development workflows

The combination of human creativity, structured specifications, and AI assistance enabled rapid prototyping, comprehensive testing, and robust implementation of complex features like real-time collaboration and drag-and-drop interactions.

*This project demonstrates that well-structured agent guidance can significantly accelerate development while maintaining code quality and architectural integrity.*

## 📝 License

This project is licensed under the **Creative Commons Attribution-ShareAlike 4.0 International License** (CC BY-SA 4.0).

### What this means:

- ✅ **Use freely** for personal, educational, or commercial purposes
- ✅ **Share and distribute** the application and materials
- ✅ **Modify and adapt** for your specific needs
- ✅ **Use in workshops** and training sessions

### Requirements:

- 📝 **Attribution**: Credit the original project when using or sharing
- 🔄 **ShareAlike**: Any derivative works must use the same CC BY-SA 4.0 license
- 📋 **Indicate changes**: Note any modifications you've made

### Attribution Example:
```
Leadership Values Cards by dgrummm
Licensed under CC BY-SA 4.0
Original: https://github.com/dgrumm/leadership-values-card-sort
```

For the full license text, see: https://creativecommons.org/licenses/by-sa/4.0/

This license ensures the educational content remains open and accessible while encouraging community contributions and proper attribution.

## 🆘 Support

- Check the [Issues](../../issues) page for known problems
- Create a new issue for bug reports or feature requests
- Review the project documentation in `/specs/` for detailed requirements

