# SeniorNett Product Boundaries

SeniorNett is a senior-facing appliance first. Senior-facing screens show only the actions needed right now. Setup, troubleshooting, upload, moderation, and profile maintenance belong to caregiver/admin flows unless a guided senior flow is explicitly designed.

## Route Classification

| Route | Audience | Main task | Notes |
|---|---|---|---|
| `/` | Senior-facing | Choose one simple activity | Home cards need concrete helper text. |
| `/social-hub` | Senior-facing | Speak with people | Must guide: choose area, choose person/group, read/write. |
| `/fotos-papiere` | Senior-facing with caregiver-only setup actions | View/search documents | Upload is caregiver/admin unless a guided senior flow is added. |
| `/lotti-live` | Senior-facing | Ask Lotti a simple question | Empty state should suggest safe everyday questions. |
| `/lexikon` | Senior-facing | Get a simple explanation | Avoid persistent encyclopedia layout. |
| `/audio` | Senior-facing | Listen to radio, shows, or books | Main modes are large choices, not compact tabs. |
| `/news` | Senior-facing | Read calm news | Reload is secondary and should not compete with reading. |
| `/wetter` | Senior-facing | Check weather | Search is optional; default place must work. |
| `/notfall` | Senior-facing | Call emergency help or read emergency card | Profile editing is not senior-facing here. |
| `/karte` | Senior-facing with advanced map controls | Find places or understand surroundings | Layers/search are advanced; provide labels, legend, and simple presets. |
| `/video` | Senior-facing | Watch selected programmes | Reload is secondary and should not compete with choosing a programme. |

## Action Classification

| Action | Audience | Rule |
|---|---|---|
| Send message | Senior-facing | Keep as the primary action inside conversation. |
| Join group | Senior-facing | Explain plainly before joining. |
| Upload document/photo | Caregiver/admin by default | Do not show beside senior browsing/search; use guided flow if exposed to seniors. |
| Edit emergency/profile data | Caregiver/admin | Senior emergency screen only reads the card. |
| Reload data | Secondary/maintenance | Use quiet secondary action; never the main task. |
| Map layer switch | Advanced senior-facing | Must have visible labels and a legend; never icon-only. |
| Search documents | Senior-facing | Use as a separate task, not beside every other control. |
| Ask Lotti about a document | Senior-facing | Use a guided task after document selection. |

## Implementation Rule

Every new route or major action must be classified as `senior-facing`, `caregiver-facing`, or `admin/setup` before it appears in the UI. If the action is not senior-facing, keep it out of senior task screens or place it behind a caregiver/admin route.

