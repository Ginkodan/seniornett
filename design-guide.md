# Refactoring & UI/UX Guidelines

This document defines how the application should be structured, refactored, and extended.

The goal is to build a **clean, maintainable, and highly consistent system** — both in code and user experience.

---

## 1. General Principles

- Follow **DRY**, **YAGNI**, and **clean code** principles  
- Prefer **small, focused functions and components**  
- Use **clear, domain-driven naming**  
- Optimize for **readability and long-term maintainability**, not cleverness  

---

## 2. Behavior & API Changes

Refactoring is allowed to change behavior, APIs, and data flow — but only intentionally.

### Allowed

- Simplifying data flow  
- Improving architecture  
- Making behavior more predictable or correct  
- Improving developer experience  

### Required for every change

- Explain **what changed**  
- Explain **why it is better**  
- Mention **possible side effects**  

---

## 3. Architecture Rules

### Separation of concerns

- **React components**
  - UI only (rendering + minimal orchestration)  
  - No business logic  

- **Business logic**
  - Must live in `src/lib/<domain>`  
  - Must be testable in isolation  

- **Shared logic**
  - Goes into `src/lib/shared`  

### Constraints

- No circular dependencies  
- Keep domain boundaries clean  
- Avoid cross-domain leakage  

---

## 4. Design System (Critical)

The UI must be built as a **consistent, reusable design system**.

### Approach

Always build from smallest to largest:

1. Typography (text, headings, labels)  
2. Basic elements (buttons, inputs, badges/chips)  
3. Composed components (cards, forms, modals, lists)  

### Rules

- If a UI pattern appears more than once → it must become a reusable component  
- The same UI element must always use the same component  
- No one-off styling in pages  

### Goal

Changes to a component must propagate everywhere automatically  

---

## 5. SeniorNet UI/UX Principles (Mandatory)

The application should feel like a simple appliance, not a complex website.

### High contrast everywhere

- All content must be readable in bright environments  
- Avoid low-contrast greys for important information  

### Home is always one action away

- The user must never feel lost  
- Avoid deep navigation and hidden flows  

### Home button consistency

- Same label, icon, position, and behavior everywhere  

### Accessibility is the default

- Large text and touch targets  
- Clear focus states  
- Screen reader and keyboard support where applicable  

### Adjustable font size

- Must be available in the UI  
- Must be immediate and persistent  

### One primary action per screen

- Avoid competing actions  

### Calm, human wording

- Use simple, reassuring language  
- Avoid technical jargon  

### No dark patterns

- No ads, traps, or manipulative UI  

### Mistakes must be recoverable

- Provide undo, cancel, or safe fallback options  

### No external links

- Users must never accidentally leave the application  

### Hide complexity

- Technical details must not appear in the main UI  

---

## 6. Design Implementation Rules

This section defines concrete defaults. These are not suggestions.

### Typography

- Use the following font stack everywhere:

```css
font-family: 'Atkinson Hyperlegible', Arial, Helvetica, Verdana, sans-serif;
```

- Use relative units (`rem`) only for font sizes  
- Base font size must be at least 1rem (16px equivalent)  
- Body text should default to 1.125rem – 1.25rem  
- Line height must be >= 1.5  

### Rules

- Do NOT use:
  - thin font weights for important text  
  - long ALL CAPS text  
  - italics for critical content  

---

### Colors & Contrast

- Text contrast must meet WCAG AA (4.5:1)  
- Prefer near-black text on white or warm-white backgrounds  
- Never use light grey text for important information  

### Color usage rules

- Color must NEVER be the only way to convey meaning  
- Always combine with text, icons, or labels  

---

### Layout

- Prefer single-column layouts  
- Avoid dense UI  
- Use consistent spacing  

---

### Interaction

- Minimum touch target: 44x44px  
- Must work without hover  
- Focus states must be clearly visible  

---

### States

- Always support:
  - loading  
  - error  
  - empty  

- Always explain what is happening and what the user can do  

---

## 7. Component Design

- Components must be reusable, composable, and clearly scoped  

### Rules

- One component per file  
- Styling lives inside the component  
- Clear and minimal props API  
- Explicit variants (size, state, color)  

---

## 8. Styling

- No scattered Tailwind classes across pages  
- No inline duplication  
- Use consistent tokens for:
  - colors  
  - spacing  
  - typography  

---

## 9. Refactoring Process

1. Analyze the entire codebase  
2. Identify issues  
3. Propose a plan  
4. Refactor in small steps  
5. Verify after each step  

---

## 10. TypeScript Rules

- No `any` unless necessary  
- Prefer explicit types  
- Avoid unsafe assertions  
- Use strict null handling  

---

## 11. Data & Side Effects

- Prefer pure functions  
- Isolate side effects  
- Avoid hidden mutations  

---

## 12. Structure

- One component per file  
- Organize by domain  

---

## 13. Naming

- Use full, descriptive English names  
- No abbreviations  

---

## 14. Definition of Done

- No duplication  
- Consistent UI  
- Reusable components  
- UX principles applied  
- Testable logic  
- Readable code  

---

## 15. Guiding Principle

> Prefer **simple, clear, consistent** solutions over clever ones.
