# GitHub Copilot Instructions

## Core Philosophy

This project follows a **utilities-first architecture** where cross-cutting concerns are centralized in reusable modules rather than scattered throughout the codebase. Every implementation should prioritize reuse, extension, and maintainability.

This project use yarn

---

## Context7 Usage

Always use context7 when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.

## Guiding Principles

### 1. Centralize, Don't Duplicate

- **Never scatter utility logic** across feature folders or components
- Check for existing utilities before writing new helper functions
- If a utility doesn't exist, create it in the appropriate shared location
- Follow the principle: **Write once, import everywhere**

### 2. Extend Over Inline

- **Always look for existing utilities** that can be extended
- Prefer updating a centralized helper over writing inline logic
- If an edge case isn't covered, enhance the utility rather than work around it
- Inline functions should be the last resort, not the first choice

### 3. Design for Reusability

- Write utilities that are:
  - **Side-effect free** - Pure functions wherever possible
  - **Type-safe** - Leverage TypeScript for compile-time safety
  - **Defensive** - Handle malformed input gracefully
  - **Composable** - Small, focused functions that work together
- Name functions descriptively using action verbs (`sanitize`, `validate`, `format`, `parse`, `normalize`)

### 4. Follow Established Patterns

- Study existing implementations before creating new features
- Reuse design patterns consistently across the codebase
- When you see a pattern repeated 2+ times, extract it into a utility
- Document patterns so future implementations stay consistent

### 5. Keep Dependencies Shallow

- Utilities should only depend on:
  - Other utilities
  - Standard library features
  - Core framework primitives
- **Never** make utilities depend on feature-specific modules
- This keeps the dependency graph clean and prevents circular dependencies

---

## Practical Guidelines

### Before Writing Code

1. **Search first** - Look for similar functionality in existing utilities
2. **Understand the pattern** - Study how related features are implemented
3. **Plan for reuse** - Consider if this logic will be needed elsewhere
4. **Check conventions** - Follow naming and organization patterns

### When Creating Utilities

```typescript
// ✅ GOOD: Focused, reusable, defensive
export function sanitizeSlug(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().toLowerCase().replace(/\s+/g, '-');
}

// ❌ BAD: Inline, scattered, repeated
function processSlug(title) {
  return title.trim().toLowerCase().replace(/\s+/g, '-');
}
```

### Utility Organization

Organize utilities by concern, not by feature:

```
utils/
├── strings.ts      # String manipulation & validation
├── numbers.ts      # Numeric operations & sanitization
├── dates.ts        # Date formatting & parsing
├── validation.ts   # Common validators
├── formatting.ts   # Display formatters
└── identifiers.ts  # ID normalization & generation
```

### When Extending Features

- **Import from utils** instead of recreating logic
- **Compose existing utilities** to build complex behaviors
- **Add tests** for new utility functions
- **Update documentation** when creating new shared helpers

### Code Review Checklist

Before submitting code, verify:

- ✅ No duplicated helper functions
- ✅ No inline logic that could be a utility
- ✅ Existing patterns are followed
- ✅ Utilities are properly imported and reused
- ✅ New utilities are documented and tested
- ✅ Dependencies remain shallow and clean

---

## Common Utility Categories

### String Operations

- Whitespace handling (`trim`, `normalize`)
- Case transformations (`toTitleCase`, `toKebabCase`)
- Validation (`isNonEmpty`, `isEmail`, `isUrl`)
- Safe conversions (`toString`, `toNullableString`)

### Number Operations

- Validation (`isFinite`, `isInteger`, `isPositive`)
- Clamping and ranges (`clamp`, `between`)
- Sanitization (`sanitizeDimension`, `sanitizeQuality`)
- Formatting (`formatCurrency`, `formatPercentage`)

### Array/Object Operations

- Deduplication (`unique`, `uniqueBy`)
- Filtering (`compact`, `partition`)
- Transformation (`groupBy`, `keyBy`)
- Safe access (`get`, `pick`, `omit`)

### Validation & Sanitization

- Input validation (`validateEmail`, `validateUrl`)
- Data sanitization (`sanitizeHtml`, `sanitizeFilename`)
- Type guards (`isString`, `isNumber`, `isObject`)
- Schema validation (use existing validation library)

### Identifiers & Slugs

- ID normalization (`normalizeId`, `sanitizeId`)
- Slug generation (`createSlug`, `ensureUniqueSlug`)
- Hash generation (`generateHash`, `createChecksum`)

---

## Anti-Patterns to Avoid

### ❌ Scattered Helpers

```typescript
// Don't: Helper function in component file
function formatDate(date: Date) {
  /* ... */
}

export function MyComponent() {
  const formatted = formatDate(new Date());
  // ...
}
```

### ❌ Copy-Paste Utilities

```typescript
// Don't: Same logic in multiple files
// file1.ts
function isEmpty(str) {
  return !str || !str.trim();
}

// file2.ts
function isEmpty(str) {
  return !str || !str.trim();
}
```

### ❌ Inline Validation

```typescript
// Don't: Validation logic mixed with business logic
if (typeof id === 'string' && id.trim().length > 0) {
  // process id
}

// Do: Use utility
import { isNonEmptyString } from '@/utils/strings';
if (isNonEmptyString(id)) {
  // process id
}
```

### ❌ Feature-Specific Utilities

```typescript
// Don't: Utility depends on feature
import { getCurrentUser } from '@/features/auth';

export function formatUserName() {
  const user = getCurrentUser(); // Bad: side effect
  return user.name;
}
```

---

## Decision Tree

When writing code, follow this decision tree:

```
Need to process/validate data?
│
├─ Does a utility exist?
│  ├─ Yes → Import and use it
│  └─ No → ↓
│
├─ Could this be reused elsewhere?
│  ├─ Yes → Create utility
│  └─ No → ↓
│
├─ Is this business logic specific to one feature?
│  ├─ Yes → Keep in feature folder
│  └─ No → Create utility
│
└─ Default: Create utility (err on side of reusability)
```

---

## Remember

- **Utilities are the foundation** - Bugs here cascade everywhere
- **Composition over duplication** - Build complex functions from simple ones
- **Documentation through naming** - Functions should read like instructions
- **Future-proof by design** - Write code that's easy to extend
- **Think in patterns** - Consistent approaches make code predictable

**Every utility you create makes the next developer's job easier. Every inline function you avoid makes the codebase more maintainable.**

---

## Questions to Ask

Before implementing, always self-check and self-ask:

1. Is there an existing utility I can use?
2. Could I extend an existing utility instead?
3. Will this logic be needed elsewhere?
4. Am I following established patterns?
5. Are my dependencies shallow and clean?

If in doubt, **centralize and reuse** rather than inline and duplicate.
