# SeniorNet UI/UX Guidelines

SeniorNet should feel like a simple appliance, not like a normal website. The interface must be calm, readable, predictable, and safe.

## Core Principles

### High contrast everywhere

Text, icons, borders, buttons, focus states, and status messages must remain readable in bright daylight and on older tablet screens. Prefer near-black text on white or warm-white backgrounds. Do not use pale grey text for important information.

### Home is always one action away

The user must never feel lost. Every screen must provide a clear way back to Home. Avoid deep navigation, stacked modal dialogs, and flows with many hidden steps.

### The Home button is always the same

The Home button must use the same label, icon, position, and behaviour across every screen and every state. The user should never need to relearn how to return home.

### Accessibility is the default

Large text, large touch targets, clear focus states, keyboard support where relevant, screen-reader-friendly structure, and plain language are not optional extras. They are the default design.

### Font size is adjustable in the UI

Text size controls should be visible, simple, immediate, and persistent per device. Users should not need to enter browser or system settings to make the site readable.

### One primary action per screen

Each screen should have one obvious next step. Avoid competing primary buttons or dense menus that require interpretation.

### Calm, human wording

Use reassuring everyday German. Avoid technical jargon, error codes, internet-native phrases, and blame. Explain what is happening and what the user can do next.

### No dark patterns

No ads, no engagement traps, no manipulative notifications, no recommendation rabbit holes, and no interface elements designed to keep the user clicking.

### Mistakes must be recoverable

Actions should be forgiving. Provide clear back or cancel options. Use confirmations only where they reduce real risk, not as extra friction.

### No outlinks

There must be no links to external targets. The user should never accidentally leave SeniorNet or open another website, tab, app, or browser view.

### Complexity belongs to caregivers, not users

Configuration, moderation, setup, troubleshooting, and account management belong in caregiver or admin tooling, not on the senior-facing screen.

## General Design Rules

- Use a highly readable sans-serif font such as Atkinson Hyperlegible, Arial, Helvetica, or Verdana.
- Use relative font sizes such as `rem`, not fixed pixel sizes for text.
- Body text should be large by default.
- Buttons and touch targets should be large, clearly labelled, and well spaced.
- Icons should support text, not replace it.
- Avoid thin fonts, italics for important text, long all-caps text, and dense layouts.
- Use simple one-column layouts wherever possible.
- Keep navigation shallow: Home → Section → Detail should be the maximum depth.
- Avoid popups, autoplay, carousels, animations, and disappearing messages.
- Important states such as offline, loading, or errors must be clearly explained.
- The interface must work without hover.
- Focus states must be clearly visible.
- High contrast mode and text size settings should persist on the device.
- The senior-facing interface should never expose technical details unless explicitly needed for support.