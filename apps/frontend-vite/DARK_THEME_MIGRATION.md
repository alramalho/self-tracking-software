# Dark Theme Migration Checklist

## Overview
This document tracks the migration of all components to support dark theme using semantic tokens.

**Migration Strategy:** Migrate components in small batches (2-3 at a time), testing after each batch to ensure light theme remains intact.

**Reference:** See [SEMANTIC_TOKEN_GUIDE.md](./SEMANTIC_TOKEN_GUIDE.md) for token mapping rules.

---

## Phase 1: Infrastructure ✅ COMPLETED

- [x] Add `themeMode` enum to database schema (LIGHT/DARK/AUTO)
- [x] Generate Prisma client
- [x] Enable dark mode CSS custom properties in index.css
- [x] Update theme context to support `themeMode` and `effectiveThemeMode`
- [x] Add `updateThemeMode` function to theme service
- [x] Create semantic token mapping guide

---

## Phase 2: Component Migration

### UI Components (Priority: High)
Core reusable components used across the app.

- [x] **components/ui/button.tsx** - Already uses semantic tokens ✓
- [x] **components/ui/card.tsx** - ✅ MIGRATED (Batch 3)
- [x] **components/ui/input.tsx** - Already uses semantic tokens ✓
- [x] **components/ui/label.tsx** - Already uses semantic tokens ✓
- [x] **components/ui/badge.tsx** - Already uses semantic tokens ✓
- [x] **components/ui/dialog.tsx** - ✅ MIGRATED (Batch 3)
- [x] **components/ui/select.tsx** - Already uses semantic tokens ✓
- [x] **components/ui/switch.tsx** - ✅ MIGRATED (Batch 12)
- [x] **components/ui/skeleton.tsx** - Already uses semantic tokens ✓
- [x] **components/ui/avatar.tsx** - ✅ MIGRATED (Batch 9)
- [x] **components/ui/separator.tsx** - Already uses semantic tokens ✓
- [x] **components/ui/textarea.tsx** - Already uses semantic tokens ✓
- [x] **components/ui/tabs.tsx** - ✅ MIGRATED (Batch 12)
- [x] **components/ui/progress.tsx** - Already uses semantic tokens ✓
- [x] **components/ui/calendar.tsx** - ✅ MIGRATED (Batch 13)
- [x] **components/ui/drawer.tsx** - ✅ MIGRATED (Batch 12)

### Layout Components (Priority: High)

- [x] **components/BottomNav.tsx** - ✅ MIGRATED (Batch 1)
- [x] **components/AuthLayout.tsx** - ✅ MIGRATED (Batch 13)

### Activity Components (Priority: High)

- [x] **components/ActivityCard.tsx** - ✅ MIGRATED (Batch 1)
- [x] **components/ActivityEditor.tsx** - Already uses semantic tokens ✓
- [x] **components/ActivityGridRenderer.tsx** - ✅ MIGRATED (Batch 7)
- [x] **components/ActivityLoggerPopover.tsx** - ✅ MIGRATED (Batch 9)
- [x] **components/ActivityEntryEditor.tsx** - Already uses semantic tokens ✓
- [x] **components/ActivityEntryPhotoCard.tsx** - ✅ MIGRATED (Batch 11)
- [x] **components/SmallActivityEntryCard.tsx** - ✅ MIGRATED (Batch 5)
- [x] **components/ActivityPhotoUploader.tsx** - ✅ MIGRATED (Batch 12)

### Plan Components (Priority: High)

- [x] **components/PlansRenderer.tsx** - ✅ MIGRATED (Batch 4)
- [x] **components/PlanCard.tsx** - ✅ MIGRATED (Batch 3)
- [x] **components/PlanRendererv2.tsx** - ✅ MIGRATED (Batch 4)
- [x] **components/PlanProgressCard.tsx** - ✅ MIGRATED (Batch 8)
- [x] **components/PlanWeekDisplay.tsx** - ✅ MIGRATED (Batch 5)
- [x] **components/PlanSessionsRenderer.tsx** - ✅ MIGRATED (Batch 6)
- [x] **components/PlanActivityEntriesRenderer.tsx** - ✅ MIGRATED (Batch 6)
- [ ] **components/PlanEditModal.tsx** - Plan editing modal
- [x] **components/PlanGroupProgressChart.tsx** - ✅ MIGRATED (Batch 6 - Fix)
- [ ] **components/CreatePlanCardJourney.tsx** - Plan creation flow

### Plan Configuration Components (Priority: Medium)

- [ ] **components/plan-configuration/PlanConfigurationForm.tsx** - Main form
- [ ] **components/plan-configuration/Step.tsx** - Step wrapper
- [ ] **components/plan-configuration/steps/GoalStep.tsx** - Goal setting
- [ ] **components/plan-configuration/steps/DurationStep.tsx** - Duration picker
- [ ] **components/plan-configuration/steps/OutlineStep.tsx** - Outline editor
- [ ] **components/plan-configuration/steps/ActivitiesStep.tsx** - Activity selection
- [ ] **components/plan-configuration/steps/EmojiStep.tsx** - Emoji picker
- [ ] **components/plan-configuration/steps/FinishingDateStep.tsx** - Date picker
- [ ] **components/plan-configuration/steps/MilestonesStep.tsx** - Milestone editor
- [ ] **components/plan-configuration/ActivityItem.tsx** - Activity item
- [ ] **components/plan-configuration/Number.tsx** - Number display
- [ ] **components/plan-configuration/NumberInput.tsx** - Number input
- [ ] **components/plan-configuration/OutlineOption.tsx** - Outline option
- [ ] **components/plan-configuration/DurationOption.tsx** - Duration option

### Onboarding Components (Priority: Medium)

- [ ] **components/OnboardingContainer.tsx** - Onboarding wrapper
- [ ] **components/steps/WelcomeStep.tsx** - Welcome screen
- [ ] **components/steps/PlanGoalSetter.tsx** - Goal setting
- [ ] **components/steps/PlanGenerator.tsx** - Plan generation
- [ ] **components/steps/PlanActivitySetter.tsx** - Activity setup
- [ ] **components/steps/PlanTypeSelector.tsx** - Type selection
- [ ] **components/steps/PlanProgressInitiator.tsx** - Progress init
- [ ] **components/steps/NotificationsSelector.tsx** - Notification setup
- [ ] **components/steps/PartnerSelector.tsx** - Partner selection
- [ ] **components/steps/HumanPartnerFinder.tsx** - Human partner finder
- [ ] **components/steps/AIPartnerFinder.tsx** - AI partner finder

### Metric Components (Priority: Medium)

- [ ] **components/MetricIsland.tsx** - Metric display
- [ ] **components/MetricRater.tsx** - Metric rating UI
- [ ] **components/MetricRaters.tsx** - Multiple raters
- [ ] **components/MetricRatingSelector.tsx** - Rating selector
- [ ] **components/MetricBarChart.tsx** - Bar chart
- [ ] **components/MetricWeeklyView.tsx** - Weekly view
- [ ] **components/WeekMetricBarChart.tsx** - Week bar chart
- [ ] **components/metrics/MetricInsightsCard.tsx** - Insights card
- [ ] **components/metrics/MetricTrendCard.tsx** - Trend card
- [ ] **components/metrics/TrendHelpPopover.tsx** - Help popover
- [ ] **components/metrics/CorrelationHelpPopover.tsx** - Correlation help
- [ ] **components/metrics/CorrelationEntry.tsx** - Correlation display
- [x] **components/HomepageMetricsSection.tsx** - ✅ MIGRATED (Batch 10)

### Profile & Settings Components (Priority: Medium)

- [x] **components/profile/ProfileSettingsPopover.tsx** - ✅ MIGRATED (Batch 2)
- [ ] **components/profile/EditFieldPopups.tsx** - Field editors
- [x] **components/profile/ColorPalettePickerPopup.tsx** - ✅ MIGRATED (Batch 2)
- [x] **components/profile/ThemeModeSwitcher.tsx** - ✅ NEW (Batch 2) - Uses semantic tokens from start
- [ ] **components/CollapsibleSelfUserCard.tsx** - User card
- [ ] **components/DeleteAccountDialog.tsx** - Delete account dialog

### Social & Search Components (Priority: Medium)

- [x] **components/UserSearch.tsx** - ✅ MIGRATED (Batch 13)
- [x] **components/RecommendedUsers.tsx** - ✅ MIGRATED (Batch 13)
- [x] **components/CommentSection.tsx** - ✅ MIGRATED (Batch 11 - Fix)
- [x] **components/TimelineRenderer.tsx** - ✅ MIGRATED (Batch 10)

### Notification & Feedback Components (Priority: Low)

- [x] **components/Notifications.tsx** - ✅ MIGRATED (Batch 11)
- [ ] **components/AINotification.tsx** - AI notifications
- [ ] **components/FeedbackForm.tsx** - Feedback form
- [x] **components/FeedbackPopover.tsx** - ✅ MIGRATED (Batch 11)
- [ ] **components/UpgradePopover.tsx** - Upgrade prompts

### Coach Components (Priority: Low)

- [x] **components/CoachOverviewCard.tsx** - ✅ MIGRATED (Batch 4)
- [x] **components/MessageBubble.tsx** - ✅ MIGRATED (Batch 5)
- [ ] **components/DailyCheckinViewer.tsx** - Daily checkin
- [ ] **components/TodaysNoteSection.tsx** - Today's notes

### Utility Components (Priority: Low)

- [x] **components/Divider.tsx** - ✅ MIGRATED (Batch 8)
- [x] **components/BaseHeatmapRenderer.tsx** - ✅ MIGRATED (Batch 7)
- [x] **components/SteppedBarProgress.tsx** - ✅ MIGRATED (Batch 9)
- [ ] **components/SteppedColorPicker.tsx** - Color picker
- [ ] **components/ProgressBar.tsx** - Progress bar
- [x] **components/ProgressRing.tsx** - ✅ MIGRATED (Batch 10)
- [ ] **components/BadgeCard.tsx** - Badge display
- [ ] **components/BadgeExplainerPopover.tsx** - Badge help
- [ ] **components/MedalExplainerPopover.tsx** - Medal help
- [ ] **components/NeonGradientCard.tsx** - Gradient card
- [x] **components/AppleLikePopover.tsx** - ✅ MIGRATED (Batch 4)
- [ ] **components/ConfirmDialogOrPopover.tsx** - Confirm dialog
- [x] **components/MilestoneOverview.tsx** - ✅ MIGRATED (Batch 8)
- [ ] **components/NumberInput.tsx** - Number input
- [ ] **components/QuestionChecks.tsx** - Question checks
- [ ] **components/DynamicUISuggester.tsx** - UI suggestions
- [ ] **components/InsightsDemo.tsx** - Insights demo
- [ ] **components/InsightsBanner.tsx** - Insights banner
- [ ] **components/CorrelationEntry.tsx** - Correlation entry
- [ ] **components/ExampleCorrelations.tsx** - Example correlations
- [ ] **components/DownloadComponent.tsx** - Download UI
- [ ] **components/InviteButton.tsx** - Invite button
- [ ] **components/SignIn.tsx** - Sign in page
- [ ] **components/MobileAuthButton.tsx** - Mobile auth
- [ ] **components/GlobalErrorComponent.tsx** - Error display
- [ ] **components/MaintenanceOverlay.tsx** - Maintenance screen

### Route Components (Priority: Varies)

- [ ] **routes/index.tsx** - Homepage (High priority)
- [ ] **routes/plans.tsx** - Plans page (High priority)
- [ ] **routes/profile.$username.tsx** - Profile page (High priority)
- [ ] **routes/search.tsx** - Search page (Medium priority)
- [ ] **routes/onboarding.tsx** - Onboarding flow (Medium priority)
- [ ] **routes/join-plan.$invitationId.tsx** - Join plan (Low priority)
- [ ] **routes/insights.onboarding.tsx** - Insights onboarding (Low priority)
- [ ] **routes/signout.tsx** - Sign out (Low priority)

---

## Progress Tracking

**Total Components:** ~120
**Migrated:** 50 (including 1 new component, 14 already using semantic tokens)
**In Progress:** 0
**Remaining:** 70

### Batch Progress

- **Batch 1:** ✅ COMPLETED
  - [x] ActivityCard.tsx - Replaced bg-white → bg-card, text-gray-500 → text-muted-foreground, border-gray-300 → border-border
  - [x] BottomNav.tsx - Replaced all gray variants with semantic tokens (bg-gray-100 → bg-muted, text-gray-500 → text-muted-foreground, border-gray-200 → border-border)

- **Batch 2:** ✅ COMPLETED
  - [x] ProfileSettingsPopover.tsx - Mass replacement of all gray variants (bg-gray-50 → bg-muted/50, bg-gray-100 → bg-muted, text-gray-{400,500,600,700,800,900} → text-muted-foreground/text-foreground)
  - [x] ColorPalettePickerPopup.tsx - Replaced hover:bg-gray-50 → hover:bg-muted/50, text-gray-500 → text-muted-foreground, ring-gray-500 → ring-ring
  - [x] ThemeModeSwitcher.tsx (NEW) - Built with semantic tokens from the start, includes Light/Dark/Auto options with icons

- **Batch 3:** ✅ COMPLETED
  - [x] components/ui/card.tsx - Replaced bg-white → bg-card
  - [x] components/ui/input.tsx - Already using semantic tokens ✓
  - [x] components/ui/dialog.tsx - Replaced bg-white → bg-card
  - [x] PlanCard.tsx - Migrated all gray variants (bg-white → bg-card, ring-gray-300 → ring-border, text-gray-{200,300,500,700} → semantic tokens, drag handle, priority badge, timestamps)

- **Batch 4:** ✅ COMPLETED
  - [x] AppleLikePopover.tsx - Replaced all gray variants with semantic tokens (bg-white → bg-card, text-gray-600 → text-foreground, border-gray-200 → border-border)
  - [x] PlansRenderer.tsx - Migrated "Create New Plan" button (bg-muted/50, text-muted-foreground, border-border)
  - [x] PlanRendererv2.tsx - Comprehensive migration of large component (bg-white → bg-card, text-gray-{400,500,600,800} → semantic tokens, border-gray-{200,300} → border-border, "Log Activity" button placeholder)
  - [x] CoachOverviewCard.tsx - Migrated coach overview card (text-gray-{400,500,600,800} → semantic tokens, border-gray-{200,300} → border-border, bg-gray-300 → bg-border)

- **Batch 5:** ✅ COMPLETED
  - [x] MessageBubble.tsx - Replaced bg-gray-100 → bg-muted
  - [x] SmallActivityEntryCard.tsx - Migrated all colors (bg-gray-100 → bg-muted, ring-gray-300 → ring-border, text-gray-{500,800} → semantic tokens)
  - [x] PlanWeekDisplay.tsx - Comprehensive migration (bg-gray-{100,200} → bg-muted, text-gray-{500,700,800} → semantic tokens, progress bars, activity cards, coming up sections)

- **Batch 6:** ✅ COMPLETED
  - [x] ui/select.tsx - Already uses semantic tokens (bg-background, bg-popover, text-popover-foreground, bg-accent, bg-muted) ✓
  - [x] PlanSessionsRenderer.tsx - Migrated placeholder stub (bg-gray-50 → bg-muted, text-gray-500 → text-muted-foreground)
  - [x] PlanActivityEntriesRenderer.tsx - Migrated activity viewer (bg-gray-100/70 → bg-muted/70, text-gray-{500,600} → text-muted-foreground)
  - [x] PlanGroupProgressChart.tsx - Fixed recharts axis colors by computing CSS variables at runtime (hsl(var(--muted-foreground)) → computed color, hsl(var(--muted)) → computed color, bg-gray-500/10 text-gray-600 → bg-muted text-muted-foreground)

- **Batch 7:** ✅ COMPLETED
  - [x] BaseHeatmapRenderer.tsx - **FULLY MIGRATED** including:
    - Activity legend text (text-gray-500 hover:text-gray-700 → text-muted-foreground hover:text-foreground)
    - Empty cell colors (#EBEDF0 → theme-aware: #EBEDF0 light / #2D3748 dark)
    - All heatmap square colors via getActivityColorMatrix(isLightMode) with separate light/dark color matrices
    - All getActivityColor() calls now pass isLightMode parameter (10 calls total)
  - [x] ActivityGridRenderer.tsx - Comprehensive migration (bg-gray-100/70 → bg-muted/70, text-gray-{500,600,800} → semantic tokens, bg-white → bg-card)

- **Batch 8:** ✅ COMPLETED
  - [x] MilestoneOverview.tsx - Simple stub component (bg-gray-50 → bg-muted, text-gray-500 → text-muted-foreground)
  - [x] Divider.tsx - Replaced manual dark: classes with semantic tokens (bg-gray-300 dark:bg-gray-700 → bg-border, text-gray-500 dark:text-gray-400 → text-muted-foreground)
  - [x] PlanProgressCard.tsx - Comprehensive migration of large component (text-gray-{400,500,800} → semantic tokens, bg-white/60 ring-gray-200 → bg-card/60 ring-border, status messages, week labels, lifestyle celebration text)

- **Batch 9:** ✅ COMPLETED
  - [x] ui/avatar.tsx - Migrated AvatarFallback (bg-gray-50 → bg-muted, border-gray-200 → border-border)
  - [x] ActivityLoggerPopover.tsx - Migrated all button backgrounds (bg-white → bg-card, 3 occurrences)
  - [x] SteppedBarProgress.tsx - Migrated progress bars (bg-gray-200 → bg-muted, text-gray-700 → text-foreground)
  - [x] Verified 7 components already using semantic tokens: ui/label.tsx, ui/badge.tsx, ui/separator.tsx, ui/skeleton.tsx, ui/textarea.tsx, ActivityEditor.tsx

- **Batch 10:** ✅ COMPLETED (Homepage Components)
  - [x] TimelineRenderer.tsx - Migrated timeline component (bg-white/50 → bg-card/50, text-gray-{400,500,800} → semantic tokens)
  - [x] HomepageMetricsSection.tsx - Comprehensive migration (bg-white/60 ring-gray-200 → bg-card/60 ring-border, text-gray-{400,500,600,900} → semantic tokens, hover:bg-gray-100 → hover:bg-muted/50, border-gray-100 → border-border)
  - [x] ProgressRing.tsx - Migrated fallback stroke color (#e5e7eb → hsl(var(--muted)))

- **Batch 11:** ✅ COMPLETED (Social & Feedback Components)
  - [x] Notifications.tsx - Comprehensive migration (bg-white border-gray-200 → bg-card border-border, text-gray-{500,600,700} → semantic tokens, bg-gray-100 → bg-muted, hover:bg-gray-200 → hover:bg-muted/80)
  - [x] FeedbackPopover.tsx - Migrated form inputs and borders (border-gray-{200,300} → border-border, text-gray-{500,600,900} → semantic tokens, bg-white/bg-gray-50 → bg-card/bg-muted, hover:border-gray-400 → hover:border-muted-foreground, focus:ring-gray-200 → focus:ring-ring)
  - [x] ActivityEntryPhotoCard.tsx - Large component migration (bg-white/50 → bg-card/50, text-gray-{400,500,700,800} → semantic tokens, bg-gray-{50,100} → bg-muted, hover:bg-gray-100 → hover:bg-muted, Separator bg-gray-100 removed to use default)
  - [x] CommentSection.tsx - **FIX** after user feedback (text-gray-{400,500} → text-muted-foreground, added text-foreground to username/comment text, placeholder:text-muted-foreground for input, hover:text-gray-600 → hover:text-foreground for delete button)

- **Batch 12:** ✅ COMPLETED (UI Components & Activity Photo Uploader)
  - [x] ui/switch.tsx - Migrated switch thumb (bg-white → bg-background)
  - [x] ui/tabs.tsx - Migrated tabs (border-gray-200 → border-border, text-gray-500/700 → text-muted-foreground/foreground, data-[state=active]:text-black → data-[state=active]:text-foreground, data-[state=active]:border-black → data-[state=active]:border-foreground)
  - [x] ui/progress.tsx - Already uses semantic tokens (bg-secondary) ✓
  - [x] ui/drawer.tsx - Migrated drawer (bg-gray-50 → bg-muted, bg-gray-300 → bg-border for drag handle)
  - [x] ActivityPhotoUploader.tsx - Migrated info text (text-gray-500 → text-muted-foreground for Info icon and text)

- **Batch 13:** ✅ COMPLETED (Layout, UI Calendar, Social Components - 5 total with 1 large)
  - [x] ui/calendar.tsx - Migrated calendar background (bg-white → bg-card)
  - [x] AuthLayout.tsx - Migrated auth layout (bg-gray-50/80 → bg-muted/80, text-gray-900 → text-foreground, text-gray-600 → text-muted-foreground)
  - [x] ActivityEntryEditor.tsx - Already uses semantic tokens ✓
  - [x] UserSearch.tsx - Migrated search UI (bg-white → bg-card, text-gray-500 → text-muted-foreground, hover:bg-gray-100 → hover:bg-muted)
  - [x] RecommendedUsers.tsx - **LARGE** (counts as 2) - Comprehensive migration of user recommendations (text-gray-{600,700,400,500,900} → semantic tokens, bg-gray-{100,200,300} → bg-muted/bg-border, border-gray-{200,300} → border-border, hover:bg-gray-{100,200} → hover:bg-muted/hover:bg-muted/80, all sort buttons, card backgrounds, avatars, match scores, progress bars)

- **Batch 14:** Not started
- *(Continue adding batches as we progress)*

---

## Testing Protocol

After migrating each batch (2-3 components):

1. Run the dev server and manually test
2. Verify light theme looks identical to before
3. Test dark theme for proper contrast and readability
4. Test all color themes (blue, violet, amber, emerald, rose, slate) in both modes
5. Check component interactions (hover, focus, active states)
6. Take screenshots if needed for comparison
7. Update this checklist
8. Stop and report progress to user before continuing

---

## Notes

- Components already using semantic tokens (like ui/button.tsx) may need minimal changes
- Focus on high-priority components first (UI, Layout, Activity, Plans)
- Some components may need design decisions for dark mode
- Keep theme color system (blue, violet, etc.) working alongside dark mode
