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
- [ ] **components/ui/label.tsx** - Check text colors
- [ ] **components/ui/badge.tsx** - Check background/text colors
- [x] **components/ui/dialog.tsx** - ✅ MIGRATED (Batch 3)
- [x] **components/ui/select.tsx** - Already uses semantic tokens ✓
- [ ] **components/ui/switch.tsx** - Check toggle colors
- [ ] **components/ui/skeleton.tsx** - Check loading state colors
- [ ] **components/ui/avatar.tsx** - Check background colors
- [ ] **components/ui/separator.tsx** - Check divider colors
- [ ] **components/ui/textarea.tsx** - Check input colors
- [ ] **components/ui/tabs.tsx** - Check tab colors
- [ ] **components/ui/progress.tsx** - Check progress colors
- [ ] **components/ui/calendar.tsx** - Check calendar backgrounds
- [ ] **components/ui/drawer.tsx** - Check drawer backgrounds

### Layout Components (Priority: High)

- [x] **components/BottomNav.tsx** - ✅ MIGRATED (Batch 1)
- [ ] **components/AuthLayout.tsx** - Auth page layout

### Activity Components (Priority: High)

- [x] **components/ActivityCard.tsx** - ✅ MIGRATED (Batch 1)
- [ ] **components/ActivityEditor.tsx** - Activity form
- [x] **components/ActivityGridRenderer.tsx** - ✅ MIGRATED (Batch 7)
- [ ] **components/ActivityLoggerPopover.tsx** - Activity logging UI
- [ ] **components/ActivityEntryEditor.tsx** - Entry editing
- [ ] **components/ActivityEntryPhotoCard.tsx** - Photo card display
- [x] **components/SmallActivityEntryCard.tsx** - ✅ MIGRATED (Batch 5)
- [ ] **components/ActivityPhotoUploader.tsx** - Photo upload UI

### Plan Components (Priority: High)

- [x] **components/PlansRenderer.tsx** - ✅ MIGRATED (Batch 4)
- [x] **components/PlanCard.tsx** - ✅ MIGRATED (Batch 3)
- [x] **components/PlanRendererv2.tsx** - ✅ MIGRATED (Batch 4)
- [ ] **components/PlanProgressCard.tsx** - Progress visualization
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
- [ ] **components/HomepageMetricsSection.tsx** - Homepage metrics

### Profile & Settings Components (Priority: Medium)

- [x] **components/profile/ProfileSettingsPopover.tsx** - ✅ MIGRATED (Batch 2)
- [ ] **components/profile/EditFieldPopups.tsx** - Field editors
- [x] **components/profile/ColorPalettePickerPopup.tsx** - ✅ MIGRATED (Batch 2)
- [x] **components/profile/ThemeModeSwitcher.tsx** - ✅ NEW (Batch 2) - Uses semantic tokens from start
- [ ] **components/CollapsibleSelfUserCard.tsx** - User card
- [ ] **components/DeleteAccountDialog.tsx** - Delete account dialog

### Social & Search Components (Priority: Medium)

- [ ] **components/UserSearch.tsx** - User search
- [ ] **components/RecommendedUsers.tsx** - User recommendations
- [ ] **components/CommentSection.tsx** - Comments display
- [ ] **components/TimelineRenderer.tsx** - Timeline view

### Notification & Feedback Components (Priority: Low)

- [ ] **components/Notifications.tsx** - Notification list
- [ ] **components/AINotification.tsx** - AI notifications
- [ ] **components/FeedbackForm.tsx** - Feedback form
- [ ] **components/FeedbackPopover.tsx** - Feedback popover
- [ ] **components/UpgradePopover.tsx** - Upgrade prompts

### Coach Components (Priority: Low)

- [x] **components/CoachOverviewCard.tsx** - ✅ MIGRATED (Batch 4)
- [x] **components/MessageBubble.tsx** - ✅ MIGRATED (Batch 5)
- [ ] **components/DailyCheckinViewer.tsx** - Daily checkin
- [ ] **components/TodaysNoteSection.tsx** - Today's notes

### Utility Components (Priority: Low)

- [ ] **components/Divider.tsx** - Dividers
- [x] **components/BaseHeatmapRenderer.tsx** - ✅ MIGRATED (Batch 7)
- [ ] **components/SteppedBarProgress.tsx** - Progress bar
- [ ] **components/SteppedColorPicker.tsx** - Color picker
- [ ] **components/ProgressBar.tsx** - Progress bar
- [ ] **components/ProgressRing.tsx** - Progress ring
- [ ] **components/BadgeCard.tsx** - Badge display
- [ ] **components/BadgeExplainerPopover.tsx** - Badge help
- [ ] **components/MedalExplainerPopover.tsx** - Medal help
- [ ] **components/NeonGradientCard.tsx** - Gradient card
- [x] **components/AppleLikePopover.tsx** - ✅ MIGRATED (Batch 4)
- [ ] **components/ConfirmDialogOrPopover.tsx** - Confirm dialog
- [ ] **components/MilestoneOverview.tsx** - Milestone display
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
**Migrated:** 21 (including 1 new component, 2 already using semantic tokens)
**In Progress:** 0
**Remaining:** 99

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

- **Batch 8:** Not started
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
