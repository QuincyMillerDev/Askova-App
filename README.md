
# TODOS

### Backend
- [x] Add Authentication with NextAuth
- [x] Add support for multiple quiz sessions at once
- [x] Add Google as OAuth Provider, remove Discord
- [x] LLM implementation
- [x] Improve data syncing between Dexie and Prisma
- [ ] Storing Files
- [x] Update status fields for quizzes and messages
- [ ] Sync user preferences (pinned quizzes, light/darkmode)

### Frontend
- [x] Migrate existing UI from previous repository
- [x] Add messages components that support markdown
- [x] LLM response streaming on frontend
- [x] Add settings/profile page
- [ ] Add other settings/ pages
- [x] Add components for Auth
- [ ] Highlight the selected quiz session
- [ ] Warn users their quizzes will only be saved if they login
- [ ] Implement Terms of Service and Privacy Policy pages
- [ ] Delete quizzes
- [ ] DARK MODE PLEASEEEE

### Core functionality
- [ ] Setup study session flow:
  - [ ] Upload file/pasting content
  - [ ] Content initiates a study session
  - [x] AI asks open-ended questions and evaluates user answers

### Payment stuff
- [ ] Limit unauthenticated users to 10 messages.
- [ ] Figure out payment tier.
- [ ] Integrate payment, Stripe?

### BUGS
- [ ] Google Avatar not working?
- [ ] LLM sometimes cannot parse stream, only happens on first load/message, unauthenticated

  ## Relevant Docs
- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Dexie.js](https://dexie.org/docs/)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)
- [T3 Stack](https://create.t3.gg/)