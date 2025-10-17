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

- [x] **components/BottomNav.tsx** - ✅ MIGRATED (Batch 1, Fixed manual dark: classes in Batch 22)
- [x] **components/AuthLayout.tsx** - ✅ MIGRATED (Batch 13)

### Activity Components (Priority: High)

- [x] **components/ActivityCard.tsx** - ✅ MIGRATED (Batch 1)
- [x] **components/ActivityEditor.tsx** - Already uses semantic tokens ✓
- [x] **components/ActivityGridRenderer.tsx** - ✅ MIGRATED (Batch 7)
- [x] **components/ActivityLoggerPopover.tsx** - ✅ MIGRATED (Batch 9)
- [x] **components/ActivityEntryEditor.tsx** - Already uses semantic tokens ✓
- [x] **components/ActivityEntryPhotoCard.tsx** - ✅ MIGRATED (Batch 11, Verified in Batch 22)
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
- [x] **components/PlanEditModal.tsx** - ✅ MIGRATED (Batch 16)
- [x] **components/PlanGroupProgressChart.tsx** - ✅ MIGRATED (Batch 6 - Fix)
- [x] **components/CreatePlanCardJourney.tsx** - ✅ MIGRATED (Batch 16)

### Plan Configuration Components (Priority: Medium)

- [x] **components/plan-configuration/PlanConfigurationForm.tsx** - Already uses semantic tokens ✓
- [x] **components/plan-configuration/Step.tsx** - Already uses semantic tokens ✓
- [x] **components/plan-configuration/steps/GoalStep.tsx** - Already uses semantic tokens ✓
- [x] **components/plan-configuration/steps/DurationStep.tsx** - Already uses semantic tokens ✓
- [x] **components/plan-configuration/steps/OutlineStep.tsx** - ✅ MIGRATED (Batch 18)
- [x] **components/plan-configuration/steps/ActivitiesStep.tsx** - ✅ MIGRATED (Batch 18)
- [x] **components/plan-configuration/steps/EmojiStep.tsx** - Already uses semantic tokens ✓
- [x] **components/plan-configuration/steps/FinishingDateStep.tsx** - FILE DOES NOT EXIST ❌
- [x] **components/plan-configuration/steps/MilestonesStep.tsx** - ✅ MIGRATED (Batch 18)
- [x] **components/plan-configuration/ActivityItem.tsx** - ✅ MIGRATED (Batch 17)
- [x] **components/plan-configuration/Number.tsx** - Already uses semantic tokens ✓
- [x] **components/plan-configuration/NumberInput.tsx** - Already uses semantic tokens ✓
- [x] **components/plan-configuration/OutlineOption.tsx** - ✅ MIGRATED (Batch 17)
- [x] **components/plan-configuration/DurationOption.tsx** - ✅ MIGRATED (Batch 17)

### Onboarding Components (Priority: Medium)

- [x] **components/OnboardingContainer.tsx** - FILE DOES NOT EXIST ❌
- [x] **components/steps/WelcomeStep.tsx** - ✅ MIGRATED (Batch 22)
- [x] **components/steps/PlanGoalSetter.tsx** - FILE DOES NOT EXIST ❌
- [x] **components/steps/PlanGenerator.tsx** - FILE DOES NOT EXIST ❌
- [x] **components/steps/PlanActivitySetter.tsx** - ✅ MIGRATED (Batch 22)
- [x] **components/steps/PlanTypeSelector.tsx** - FILE DOES NOT EXIST ❌
- [x] **components/steps/PlanProgressInitiator.tsx** - FILE DOES NOT EXIST ❌
- [x] **components/steps/NotificationsSelector.tsx** - FILE DOES NOT EXIST ❌
- [x] **components/steps/PartnerSelector.tsx** - FILE DOES NOT EXIST ❌
- [x] **components/steps/HumanPartnerFinder.tsx** - ✅ MIGRATED (Batch 22)
- [x] **components/steps/AIPartnerFinder.tsx** - FILE DOES NOT EXIST ❌

### Metric Components (Priority: Medium)

- [x] **components/MetricIsland.tsx** - ✅ MIGRATED (Batch 14)
- [x] **components/MetricRater.tsx** - Already uses semantic tokens ✓
- [x] **components/MetricRaters.tsx** - ✅ MIGRATED (Batch 15)
- [x] **components/MetricRatingSelector.tsx** - ✅ MIGRATED (Batch 14)
- [x] **components/MetricBarChart.tsx** - ✅ MIGRATED (Batch 16)
- [x] **components/MetricWeeklyView.tsx** - ✅ MIGRATED (Batch 16)
- [x] **components/WeekMetricBarChart.tsx** - Already uses semantic tokens (data viz colors) ✓
- [x] **components/metrics/MetricInsightsCard.tsx** - ✅ MIGRATED (Batch 20)
- [x] **components/metrics/MetricTrendCard.tsx** - ✅ MIGRATED (Batch 20)
- [x] **components/metrics/TrendHelpPopover.tsx** - ✅ MIGRATED (Batch 20)
- [x] **components/metrics/CorrelationHelpPopover.tsx** - ✅ MIGRATED (Batch 20)
- [x] **components/metrics/CorrelationEntry.tsx** - ✅ MIGRATED (Batch 17) - Note: Some gray colors remain for data visualization
- [x] **components/HomepageMetricsSection.tsx** - ✅ MIGRATED (Batch 10)

### Profile & Settings Components (Priority: Medium)

- [x] **components/profile/ProfileSettingsPopover.tsx** - ✅ MIGRATED (Batch 2)
- [x] **components/profile/EditFieldPopups.tsx** - ✅ MIGRATED (Batch 15)
- [x] **components/profile/ColorPalettePickerPopup.tsx** - ✅ MIGRATED (Batch 2)
- [x] **components/profile/ThemeModeSwitcher.tsx** - ✅ NEW (Batch 2) - Uses semantic tokens from start
- [x] **components/CollapsibleSelfUserCard.tsx** - ✅ MIGRATED (Batch 14)
- [x] **components/DeleteAccountDialog.tsx** - ✅ MIGRATED (Batch 14)

### Social & Search Components (Priority: Medium)

- [x] **components/UserSearch.tsx** - ✅ MIGRATED (Batch 13)
- [x] **components/RecommendedUsers.tsx** - ✅ MIGRATED (Batch 13)
- [x] **components/CommentSection.tsx** - ✅ MIGRATED (Batch 11 - Fix, Removed manual dark: classes in Batch 22)
- [x] **components/TimelineRenderer.tsx** - ✅ MIGRATED (Batch 10)

### Notification & Feedback Components (Priority: Low)

- [x] **components/Notifications.tsx** - ✅ MIGRATED (Batch 11)
- [x] **components/AINotification.tsx** - ✅ MIGRATED (Batch 14)
- [x] **components/FeedbackForm.tsx** - ✅ MIGRATED (Batch 14)
- [x] **components/FeedbackPopover.tsx** - ✅ MIGRATED (Batch 11)
- [x] **components/UpgradePopover.tsx** - ✅ MIGRATED (Batch 14)

### Coach Components (Priority: Low)

- [x] **components/CoachOverviewCard.tsx** - ✅ MIGRATED (Batch 4)
- [x] **components/MessageBubble.tsx** - ✅ MIGRATED (Batch 5)
- [x] **components/DailyCheckinViewer.tsx** - ✅ MIGRATED (Batch 14)
- [x] **components/TodaysNoteSection.tsx** - ✅ MIGRATED (Batch 14)

### Utility Components (Priority: Low)

- [x] **components/Divider.tsx** - ✅ MIGRATED (Batch 8)
- [x] **components/BaseHeatmapRenderer.tsx** - ✅ MIGRATED (Batch 7)
- [x] **components/SteppedBarProgress.tsx** - ✅ MIGRATED (Batch 9)
- [x] **components/SteppedColorPicker.tsx** - ✅ MIGRATED (Batch 15)
- [x] **components/ProgressBar.tsx** - ✅ MIGRATED (Batch 15)
- [x] **components/ProgressRing.tsx** - ✅ MIGRATED (Batch 10)
- [x] **components/BadgeCard.tsx** - ✅ MIGRATED (Batch 15)
- [x] **components/BadgeExplainerPopover.tsx** - ✅ MIGRATED (Batch 15)
- [x] **components/MedalExplainerPopover.tsx** - Already uses semantic tokens ✓
- [x] **components/NeonGradientCard.tsx** - ✅ MIGRATED (Batch 15)
- [x] **components/AppleLikePopover.tsx** - ✅ MIGRATED (Batch 4)
- [x] **components/ConfirmDialogOrPopover.tsx** - Already uses semantic tokens ✓
- [x] **components/MilestoneOverview.tsx** - ✅ MIGRATED (Batch 8)
- [x] **components/NumberInput.tsx** - Already uses semantic tokens ✓
- [x] **components/QuestionChecks.tsx** - ✅ MIGRATED (Batch 16)
- [x] **components/DynamicUISuggester.tsx** - ✅ MIGRATED (Batch 16)
- [x] **components/InsightsDemo.tsx** - ✅ MIGRATED (Batch 16)
- [x] **components/InsightsBanner.tsx** - ✅ MIGRATED (Batch 17)
- [x] **components/CorrelationEntry.tsx** - ✅ MIGRATED (Batch 17)
- [x] **components/ExampleCorrelations.tsx** - ✅ MIGRATED (Batch 17)
- [x] **components/DownloadComponent.tsx** - ✅ MIGRATED (Batch 17)
- [x] **components/InviteButton.tsx** - ✅ MIGRATED (Batch 17)
- [x] **components/SignIn.tsx** - ✅ MIGRATED (Batch 17)
- [x] **components/MobileAuthButton.tsx** - Commented out (no migration needed) ✓
- [x] **components/GlobalErrorComponent.tsx** - ✅ MIGRATED (Batch 18)
- [x] **components/MaintenanceOverlay.tsx** - ✅ MIGRATED (Batch 18)

### Route Components (Priority: Varies)

- [x] **routes/index.tsx** - ✅ MIGRATED (Batch 19)
- [x] **routes/plans.tsx** - ✅ MIGRATED (Batch 19)
- [x] **routes/profile.$username.tsx** - ✅ MIGRATED (Batch 19)
- [x] **routes/search.tsx** - ✅ MIGRATED (Batch 19)
- [x] **routes/onboarding.tsx** - ✅ MIGRATED (Batch 19)
- [x] **routes/join-plan.$invitationId.tsx** - ✅ MIGRATED (Batch 19)
- [x] **routes/insights.onboarding.tsx** - ✅ MIGRATED (Batch 19)
- [x] **routes/signout.tsx** - ✅ MIGRATED (Batch 19)
- [x] **routes/add.tsx** - ✅ MIGRATED (Batch 21)
- [x] **routes/__root.tsx** - ✅ MIGRATED (Batch 21) - Toaster configuration

---

## Progress Tracking

**Total Components:** ~122
**Migrated:** 124 (including 1 new component, 28 already using semantic tokens, 3 onboarding steps found and migrated)
**Components don't exist:** 10 (only onboarding components + 1 plan step)
**In Progress:** 0
**Remaining:** 0

🎉 **MIGRATION COMPLETE!** All components, toasters, and manual dark: classes have been migrated to use semantic tokens and support dark theme.

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

- **Batch 14:** ✅ COMPLETED (Profile, Notification, Coach, Metric Components - 10 total with 1 large)
  - [x] CollapsibleSelfUserCard.tsx - Migrated user profile card (bg-white → bg-card, border-gray-200 → border-border, bg-gray-200 → bg-muted, text-gray-600 → text-muted-foreground)
  - [x] DeleteAccountDialog.tsx - Migrated delete confirmation (text-gray-600 → text-muted-foreground in both Dialog and Drawer variants)
  - [x] AINotification.tsx - Migrated AI notifications (text-gray-{500,700} → text-muted-foreground/text-foreground, bg-white → bg-card, border-gray-200 → border-border, bg-gray-500 → bg-muted-foreground)
  - [x] FeedbackForm.tsx - Migrated feedback modal (bg-white → bg-card, text-gray-{500,600} → text-muted-foreground, border-gray-{200} → border-border, bg-gray-50 → bg-muted, focus:ring-gray-200 → focus:ring-ring)
  - [x] UpgradePopover.tsx - **LARGE** (counts as 2) - Comprehensive migration of upgrade/pricing UI (text-gray-{500,600,700} → text-muted-foreground/text-foreground, bg-gray-{100,200} → bg-muted, bg-white → bg-card, border-gray-200 → border-border, pricing tiers, countdown timer, rocket section, founder message)
  - [x] DailyCheckinViewer.tsx - Migrated checkin viewer (border-gray-300 → border-border)
  - [x] TodaysNoteSection.tsx - Migrated note section (bg-gray-{50} → bg-muted, text-gray-{400,500} → text-muted-foreground, ring-gray-200 → ring-border, bg-white/60 → bg-card/60, hover:text-gray-700 → hover:text-foreground)
  - [x] MetricIsland.tsx - Migrated metric display (bg-gray-{50} → bg-muted, text-gray-{500,600} → text-muted-foreground, border-gray-200 → border-border, ring-gray-200 → ring-border, hover:text-gray-700 → hover:text-foreground)
  - [x] MetricRatingSelector.tsx - Migrated rating buttons (bg-gray-100 → bg-muted, border-gray-800 → border-foreground, hover:bg-gray-100 → hover:bg-muted, text-black → text-foreground)

- **Batch 15:** ✅ COMPLETED (Utility, Profile, Metric Components - 10 total with 2 large)
  - [x] MetricRater.tsx - Already uses semantic tokens ✓
  - [x] MetricRaters.tsx - Migrated disabled state text (text-black → text-foreground)
  - [x] SteppedColorPicker.tsx - **LARGE** (counts as 2) - Comprehensive migration (bg-gray-50 → bg-muted for accordion header, bg-gray-{100,50} hover:bg-gray-50 bg-white → bg-muted hover:bg-muted/50 bg-card for color options, text-gray-600 → text-foreground)
  - [x] ProgressBar.tsx - Migrated progress bar background (bg-gray-200 → bg-muted)
  - [x] BadgeCard.tsx - Migrated badge card (ring-gray-300 → ring-border, bg-white → bg-card)
  - [x] BadgeExplainerPopover.tsx - **LARGE** (counts as 2) - Comprehensive migration (text-gray-{600,900} → text-muted-foreground/text-foreground, bg-gray-50 → bg-muted, bg-white/50 → bg-card/50 for achievement cards, explainer sections)
  - [x] MedalExplainerPopover.tsx - Already uses semantic tokens ✓
  - [x] NeonGradientCard.tsx - Migrated neon card wrapper (ring-offset-white → ring-offset-background, bg-white/50 → bg-card/50)
  - [x] EditFieldPopups.tsx - Migrated profile field editors (text-gray-{600,700,500} → text-muted-foreground/text-foreground for labels and description text)

- **Batch 16:** ✅ COMPLETED (Plan, Metric, Utility Components - 10 total with 1 large)
  - [x] PlanEditModal.tsx - Migrated modal background (bg-gray-50 → bg-muted)
  - [x] CreatePlanCardJourney.tsx - Migrated page background (bg-gray-50 → bg-muted)
  - [x] ConfirmDialogOrPopover.tsx - Already uses semantic tokens (uses ui/dialog and ui/drawer) ✓
  - [x] NumberInput.tsx - Already uses semantic tokens (text-muted-foreground) ✓
  - [x] QuestionChecks.tsx - Migrated question items (text-gray-{500,700,900,600} → text-muted-foreground/text-foreground, bg-white → bg-card)
  - [x] MetricBarChart.tsx - Migrated label text (text-gray-{400,600} → text-muted-foreground with opacity variants)
  - [x] MetricWeeklyView.tsx - Migrated card and text (bg-white/60 ring-gray-200 → bg-card/60 ring-border, text-gray-{500,600} → text-muted-foreground, border-white/50 → border-card/50)
  - [x] WeekMetricBarChart.tsx - Already uses semantic tokens for neutral colors (gray colors are part of data visualization palette) ✓
  - [x] DynamicUISuggester.tsx - **LARGE** (counts as 2) - Comprehensive migration (bg-white border-gray-{200,800} → bg-card border-border/border-foreground, text-gray-{500,600,800} → text-muted-foreground/text-foreground, multiple buttons and popover)
  - [x] InsightsDemo.tsx - Migrated demo metrics (text-gray-{700,600} → text-foreground/text-muted-foreground, bg-white/60 border-white/50 → bg-card/60 border-card/50)

- **Batch 17:** ✅ COMPLETED (Plan Config, Utility, Auth Components - 10 total with 1 large)
  - [x] plan-configuration/OutlineOption.tsx - Migrated outline option (border-gray-300 bg-white → border-border bg-card, text-gray-500 → text-muted-foreground)
  - [x] plan-configuration/DurationOption.tsx - Migrated duration option (border-gray-200 hover:bg-gray-50 → border-border hover:bg-muted/50)
  - [x] plan-configuration/ActivityItem.tsx - Migrated activity selection item (border-gray-200 hover:bg-gray-50 → border-border hover:bg-muted/50, text-gray-500 → text-muted-foreground)
  - [x] CorrelationEntry.tsx - Migrated correlation display (bg-gray-400 text-gray-400 → bg-muted-foreground text-muted-foreground for weak correlations)
  - [x] ExampleCorrelations.tsx - Migrated example card (bg-white → bg-card)
  - [x] InsightsBanner.tsx - Migrated insights banner (text-gray-{400,500} → text-muted-foreground for clock and text)
  - [x] InviteButton.tsx - Migrated invite button (bg-gray-50 → bg-muted for share/copy button)
  - [x] DownloadComponent.tsx - **LARGE** (counts as 2) - Comprehensive migration of download instructions (text-gray-{500,600} → text-muted-foreground, bg-gray-{50,200} → bg-muted and bg-muted-foreground/20, multiple icon sections for iOS/Android/desktop)
  - [x] SignIn.tsx - Migrated sign in page (border-gray-200 → border-border, text-gray-500 → text-muted-foreground)

- **Batch 18:** ✅ COMPLETED (Plan Config Steps, Error/Maintenance Components - 10 total with 2 large)
  - [x] plan-configuration/steps/GoalStep.tsx - Already uses semantic tokens ✓
  - [x] plan-configuration/steps/EmojiStep.tsx - Already uses semantic tokens ✓
  - [x] plan-configuration/steps/DurationStep.tsx - Already uses semantic tokens ✓
  - [x] plan-configuration/steps/OutlineStep.tsx - Migrated outline step (text-gray-500 → text-muted-foreground, bg-white → bg-card, border-gray-200 → border-border)
  - [x] plan-configuration/steps/ActivitiesStep.tsx - Migrated activities step (text-gray-{300,400,500} → text-muted-foreground, border-gray-300 hover:bg-gray-50 → border-border hover:bg-muted/50 for Add New button)
  - [x] plan-configuration/steps/MilestonesStep.tsx - **LARGE** (counts as 2) - Comprehensive migration of milestone editor (text-gray-500 → text-muted-foreground in 8+ locations, bg-white → bg-card for inputs and buttons, bg-gray-50 → bg-muted for buttons)
  - [x] GlobalErrorComponent.tsx - Migrated error page (bg-gray-50 → bg-muted, text-gray-500 → text-muted-foreground)
  - [x] MaintenanceOverlay.tsx - **LARGE** (counts as 2) - Comprehensive migration of maintenance screen (from-gray-50 via-gray-100 → from-muted via-muted/80, bg-white → bg-card, text-gray-{400,500,600,900} → text-foreground/text-muted-foreground for title, labels, countdown, messages)

- **Batch 19:** ✅ COMPLETED (All Route Components - Final Batch 🎉)
  - [x] routes/index.tsx - Comprehensive homepage migration (bg-gray-{50,100} ring-gray-{200,300} → bg-muted ring-border for skeleton/header, text-gray-{500,600,700,900} → text-muted-foreground/text-foreground, hover:bg-gray-{100,800} → hover:bg-muted/50 or hover:bg-foreground/90, ring-gray-200 bg-white/30 → ring-border bg-card/30 for update banner, plans section with collapse button and View Details)
  - [x] routes/plans.tsx - Migrated sign-in prompt (text-gray-600 → text-muted-foreground)
  - [x] routes/profile.$username.tsx - **EXTENSIVE** migration of profile page (from-gray-50 to-white → from-muted to-background for gradient backgrounds, bg-gray-{50,100} → bg-muted for skeleton tabs and header, text-gray-{400,500,600,700,800,900} → text-muted-foreground/text-foreground for all text, hover:bg-gray-{100,800} → hover:bg-muted/50 or hover:bg-foreground/90 for buttons, border-gray-{200,300} → border-border for select and cards, stats, badges, plan cards, time range selector, empty states)
  - [x] routes/search.tsx - Migrated search page (bg-gray-{100,500,600} → bg-muted/text-muted-foreground for notification prompt, text-gray-{500,600} → text-muted-foreground for pull-to-refresh and plan selector, bg-white border-gray-300 hover:border-gray-400 → bg-card border-border hover:border-border/80 for select dropdown)
  - [x] routes/onboarding.tsx - Migrated onboarding flow (text-gray-{500,600} hover:text-gray-700 → text-muted-foreground hover:text-foreground for back button and error state)
  - [x] routes/join-plan.$invitationId.tsx - Comprehensive invitation page migration (from-gray-50 to-white → from-muted to-background for gradient backgrounds, text-gray-{600,700} → text-muted-foreground/text-foreground, bg-white border-gray-{200} → bg-card border-border for cards, bg-gray-{50} → bg-muted for activity items, hover:bg-gray-{100,800} → hover:bg-muted/50 or hover:bg-foreground/90 for buttons, inviter info, plan overview, activities list)
  - [x] routes/insights.onboarding.tsx - Migrated insights onboarding (bg-white → bg-card for text area)
  - [x] routes/signout.tsx - Migrated sign-out page (border-gray-900 → border-foreground, text-gray-600 → text-muted-foreground)

- **Batch 20:** ✅ COMPLETED (Previously Unmarked Metrics & UI Components - 8 total)
  - [x] components/metrics/CorrelationHelpPopover.tsx - Migrated help popover (text-gray-{600,500} → text-muted-foreground, bg-gray-50 → bg-muted, bg-white → bg-card for calculation box)
  - [x] components/metrics/MetricInsightsCard.tsx - Migrated help button (text-gray-400 hover:text-gray-600 → text-muted-foreground hover:text-foreground)
  - [x] components/metrics/MetricTrendCard.tsx - Migrated help button (text-gray-400 hover:text-gray-600 → text-muted-foreground hover:text-foreground)
  - [x] components/metrics/TrendHelpPopover.tsx - Migrated trend explanation (text-gray-{600,500} → text-muted-foreground, bg-gray-50 → bg-muted, bg-white → bg-card)
  - [x] components/ui/photo-uploader.tsx - Migrated photo upload UI (border-gray-300 → border-border, hover:bg-gray-50 → hover:bg-muted/50, text-gray-{400,500} → text-muted-foreground for icons and placeholder)
  - [x] components/ui/PhotoUploader.tsx - Same migration as photo-uploader.tsx (duplicate component)
  - [x] components/ui/bar-progress-loader.tsx - Migrated progress bar background (bg-gray-200 → bg-muted)
  - [x] components/ui/text-area-with-voice.tsx - Migrated text area with voice input (bg-white → bg-card, text-gray-{700} → text-foreground for label, hover:bg-gray-100 → hover:bg-muted/50 for mic button, text-gray-700 → text-foreground for mic icon)

- **Batch 21:** ✅ COMPLETED (Missing Routes & Toast Configuration - 3 total)
  - [x] routes/add.tsx - Migrated "Add New" activity button (bg-gray-{50,100} → bg-muted and bg-muted/80, border-gray-300 → border-border, text-gray-{400,500} → text-muted-foreground for icon and text)
  - [x] routes/__root.tsx - Configured Toaster components for dark theme (Sonner Toaster with theme prop based on effectiveThemeMode, react-hot-toast Toaster with theme-aware toastOptions using CSS variables hsl(var(--card)), hsl(var(--foreground)), and hsl(var(--border)))
  - [x] components/SteppedColorPicker.tsx - **FIX** Made noColor option theme-aware (hardcoded #e5e7eb → dynamic zinc-500 for dark / gray-200 for light, using getNoColorOption() helper with isDarkMode from useTheme)

- **Batch 22:** ✅ COMPLETED (Manual dark: Classes Cleanup & Onboarding Steps - 6 total)
  - [x] components/ActivityEntryPhotoCard.tsx - **VERIFIED** No manual dark: classes found (already properly migrated)
  - [x] components/BottomNav.tsx - **FIX** Removed manual dark: classes (dark:border-gray-600/40 → removed, dark:bg-gray-200/10 → removed, semantic tokens handle dark mode automatically)
  - [x] components/CommentSection.tsx - **FIX** Removed manual dark: classes (dark:bg-muted/10 → removed, dark:border-gray-700/20 → removed in 4 locations: container, show/hide buttons, comment cards, input container)
  - [x] components/steps/PlanActivitySetter.tsx - Migrated onboarding step (border-gray-200 → border-border, bg-white → bg-card, text-gray-{700,900} → text-foreground for activity list)
  - [x] components/steps/WelcomeStep.tsx - Migrated onboarding step (text-gray-{900,600} → text-foreground/text-muted-foreground for headings and descriptions, bg-white → bg-card for input)
  - [x] components/steps/HumanPartnerFinder.tsx - Migrated onboarding step (border-gray-{200,300} bg-white/gray-{50,100} → border-border bg-card/bg-muted, text-gray-{900,600} → text-foreground/text-muted-foreground, hover:bg-gray-{50,800} → hover:bg-muted/50 and hover:bg-foreground/90 for OptionCard and Continue button)

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
