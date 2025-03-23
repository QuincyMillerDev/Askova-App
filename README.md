
# TODOS

### Backend
- [x] Add Authentication with NextAuth
- [x] Add support for multiple quiz sessions at once
- [x] Add Google as OAuth Provider, remove Discord
- [ ] LLM implementation
- [ ] Improve data syncing between Dexie and Prisma
- [ ] Deleting quizzes
- [ ] Storing Files

### Frontend
- [ ] Support message modifcations
- [x] Migrate existing UI from previous repository
- [ ] Add messages components that support markdown
- [ ] LLM response streaming on frontend
- [ ] Add settings/profile page
- [x] Add components for Auth
- [ ] Highlight the selected quiz session
- [ ] Warn users there quizzes will only be saved if they login

### Core functionality
- [ ] Limit users to 10 messages if they don't log in
- [ ] Setup study session flow:
  - [ ] Upload file/pasting content
  - [ ] Content initiates a study session
  - [ ] AI asks open-ended questions and evaluates user answers
- [ ] Add payment

  ## Relevant Docs
- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Dexie.js](https://dexie.org/docs/)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)
- [T3 Stack](https://create.t3.gg/)