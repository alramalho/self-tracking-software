# Semantic Token Mapping Guide

This guide maps hardcoded Tailwind color classes to semantic tokens that support both light/dark mode and color themes.

## Background Colors

| Old (Hardcoded) | New (Semantic) | Usage |
|----------------|----------------|--------|
| `bg-white` | `bg-card` | Card backgrounds, containers |
| `bg-gray-50` | `bg-muted` | Subtle backgrounds, disabled states |
| `bg-gray-100` | `bg-muted` | Hover states, secondary backgrounds |
| `bg-gray-200` | `bg-muted` | Borders, dividers (use `bg-muted` or `border-border`) |
| `bg-gray-900` | `bg-foreground` | Dark elements in light mode |
| `bg-transparent` | `bg-transparent` | Keep as-is |

## Text Colors

| Old (Hardcoded) | New (Semantic) | Usage |
|----------------|----------------|--------|
| `text-gray-500` | `text-muted-foreground` | Secondary text, descriptions |
| `text-gray-600` | `text-muted-foreground` | Secondary text |
| `text-gray-700` | `text-foreground` | Primary text |
| `text-gray-800` | `text-foreground` | Primary text, headings |
| `text-gray-900` | `text-foreground` | Primary text, headings |
| `text-black` | `text-foreground` | Primary text |
| `text-white` | `text-primary-foreground` | Text on colored backgrounds |
| `text-red-500` | `text-destructive` | Error messages, destructive actions |

## Border Colors

| Old (Hardcoded) | New (Semantic) | Usage |
|----------------|----------------|--------|
| `border-gray-200` | `border-border` | Default borders |
| `border-gray-300` | `border-border` | Default borders |
| `border-gray-400` | `border-input` | Input borders |
| `border-white` | `border-card` | Light borders |

## Special Cases

### Theme Color Classes (Keep These!)
These classes are dynamically generated based on user's color theme and should **NOT** be replaced:
- `text-blue-500`, `text-violet-500`, etc. when using `themeColors.text`
- `bg-blue-500`, `bg-violet-500`, etc. when using `themeColors.bg`
- These come from `useThemeColors()` hook or `getThemeVariants()`

### Hardcoded Colors That Are OK
- Specific brand colors (e.g., Stripe colors, social media colors)
- Error states using `bg-red-500` or `text-red-500` (consider using `destructive` instead)
- Success states using `bg-green-500` (we may add a semantic `success` token later)

## Migration Examples

### Example 1: Button Component
```tsx
// Before
<button className="bg-white border-gray-300 text-gray-700 hover:bg-gray-100">
  Click me
</button>

// After
<button className="bg-card border-border text-foreground hover:bg-muted">
  Click me
</button>
```

### Example 2: Card with Theme Color
```tsx
// Before
<div className={cn(
  "bg-white border-2",
  selected ? "border-blue-400 bg-blue-100" : "border-gray-300"
)}>
  Content
</div>

// After
const themeColors = useThemeColors();
<div className={cn(
  "bg-card border-2",
  selected ? cn(themeColors.border, themeColors.fadedBg) : "border-border"
)}>
  Content
</div>
```

### Example 3: Text with Multiple Shades
```tsx
// Before
<div>
  <h1 className="text-gray-900">Title</h1>
  <p className="text-gray-500">Description</p>
</div>

// After
<div>
  <h1 className="text-foreground">Title</h1>
  <p className="text-muted-foreground">Description</p>
</div>
```

## Color Shades Mapping

When you see numbered shades, here's the general pattern:

- **50-100**: Very light → `bg-muted` or `bg-secondary`
- **200-300**: Light borders → `border-border`
- **400-500**: Default/Medium → `bg-primary` or `text-muted-foreground`
- **600-700**: Dark text → `text-foreground`
- **800-900**: Very dark → `text-foreground` or `bg-foreground`

## Testing Checklist

After migrating a component:
1. ✅ Test in LIGHT mode with default color theme
2. ✅ Test in DARK mode with default color theme
3. ✅ Test in LIGHT mode with all color themes (blue, violet, amber, emerald, rose, slate)
4. ✅ Test in DARK mode with all color themes
5. ✅ Verify the component's visual hierarchy is preserved
6. ✅ Check hover/focus states work correctly
7. ✅ Ensure text remains readable (sufficient contrast)

## Common Pitfalls

1. **Don't blindly replace all grays** - Some gray colors are intentionally theme-independent
2. **Preserve theme color usage** - Don't replace theme-specific colors (from `useThemeColors()`)
3. **Check contrast** - Ensure text on backgrounds has sufficient contrast in both modes
4. **Test interactions** - Hover/focus states may need adjustment
5. **Opacity matters** - `bg-white/50` should become `bg-card/50`, not just `bg-card`
