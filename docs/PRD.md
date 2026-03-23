# PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Product name (working):** Cymru Rugby (working title)  
**Scope:** Regional MVP – South Wales Valleys  
**Platform:** iOS & Android app (Expo / React Native)  
**Backend:** Supabase free tier (Postgres, Auth, Realtime)

---

## 1. Problem

Welsh grassroots rugby has:

- fragmented fixture information
- no live match visibility
- poor supporter experience
- no central player history
- zero push notifications
- inconsistent team sheets

Football solved this with Cymru Football. Rugby hasn’t.

---

## 2. Target users

**Primary**

- Supporters (parents, locals, students)
- Players
- Club volunteers (team managers)

**Secondary**

- Referees
- League admins

---

## 3. Core value proposition

*"One app where Welsh grassroots rugby lives."*

- See fixtures, results, tables
- Follow your local club
- Get live match updates
- See team sheets
- Track players and stats
- Clubs can run match ops from their phone

---

## 4. MVP scope (regional, but production)

**Geography**

- Wales

**Rugby types**

- Men's community rugby
- Junior rugby
- Universities

---

## 5. Feature requirements

### Supporter

- Account required
- Favourite teams, competitions, players
- Home feed based on favourites
- Fixtures and results
- League tables and form
- Match centre
  - score
  - timeline
  - team sheets
  - venue
- Push notifications
  - kickoff reminder
  - score change
  - cards
  - full time

### Club admin

- Claim club
- Publish team sheets
- Enter live events
- Finalise matches

### Data

- Fixtures ingested from external sources where possible
- Team sheets and live events always first-party

---

## 6. Non-functional requirements

- Offline tolerant
- Realtime updates
- Audit log for edits
- Role-based access
- No breaking schema changes
- Regional MVP but scalable nationally

---

## 7. Tech constraints

- Supabase free tier
- Expo managed workflow
- Standard editor and Git workflow (team choice)
- One repo initially
