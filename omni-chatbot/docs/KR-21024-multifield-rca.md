# KR-21024 — MultiField answer sent as empty string instead of object

## Summary
When a form contains a **MultiField** (or **Composite**) field and the user submits
**without selecting/entering a value for any of its sub-fields**, the chatbot sent a
**blank string** in the `MessageAnswer` signal instead of an **object**. The backend
deserializes a MultiField answer into a `java.util.Map`, so the empty string caused:

```
class java.lang.String cannot be cast to class java.util.Map
(java.lang.String and java.util.Map are in module java.base of loader 'bootstrap')
```

The conversation was then marked **Incomplete** ("An unexpected error has occurred, and we
cannot continue…").

If the user filled **at least one** sub-field, the answer was correctly sent as an object,
so the bug only reproduced when the whole MultiField was left untouched.

- **Component:** omni-chatbot — Angular frontend (`omni-angular`)
- **Field types affected:** `com.krista.fields.MultiField`, `com.krista.fields.Composite`
- **Regression introduced by:** the Angular frontend rewrite (PR #2226, `feature/chatbot-angular-optimised`). The behavior worked in the legacy frontend shipped in tag `omni-chatbot-2.0.17-sp2` (which predates the rewrite and does not contain `omni-angular`). This is a rewrite gap, not a line-level regression.

---

## Root Cause Analysis

On form load, every field value is initialized in `FormMessageComponent`:

`omni-angular/src/app/components/form-message/form-message.component.ts`
```ts
// initializeFormFields()
if (field.value === undefined || field.value === null || field.value === '') {
  field.value = this.getDefaultFieldValue(field);
}
```

`getDefaultFieldValue()` had no `case` for `MultiField` / `Composite`, so those field types
fell through to the default branch and were initialized to an **empty string**:

```ts
private getDefaultFieldValue(field: FormField): any {
  switch (field.fieldType) {
    case 'com.krista.fields.Text': /* ... */ return '';
    case 'com.krista.fields.PickMany':
    case 'com.krista.fields.Checkboxes': return [];
    case 'com.krista.fields.Switch':     return /* boolean */;
    case 'com.krista.fields.File':       return null;
    default:                             return '';   // <-- MultiField/Composite landed here
  }
}
```

Consequences:
- An untouched MultiField keeps `value = ''` (a **string**) and that string is what gets
  serialized into the `MessageAnswer` signal → backend `String → Map` cast fails.
- As soon as one sub-field changes, `onMultiFieldSubFieldChange()` does
  `parentField.value || {}`. The empty string is falsy, so it becomes `{}` and is spread
  into an object — which is exactly why partial fills always worked.

---

## Fix

Add explicit `MultiField` / `Composite` cases so these container fields always default to an
**object**, ensuring the `MessageAnswer` value is always a `Map` on the backend.

`omni-angular/src/app/components/form-message/form-message.component.ts`
```ts
case 'com.krista.fields.PickMany':
case 'com.krista.fields.Checkboxes':
  return [];

case 'com.krista.fields.MultiField':
case 'com.krista.fields.Composite':
  return {};
```

Notes:
- Non-breaking: the init guard only replaces `undefined` / `null` / `''`, so a real object
  value coming from the backend is preserved.
- Consistent with the existing convention in the same method (`[]` for PickMany/Checkboxes,
  `null` for File, etc.).

---

## Additional fixes (required to run the test suite)

The Angular Karma builder type-checks the whole project. Two **pre-existing** issues in
committed code (unrelated to this ticket, from PR #2226) blocked every spec from compiling
and were fixed so the suite can build and run:

1. **`core/facades/app.facade.spec.ts`** — a typed spy listed `getPoolEntry`, a method that
   does not exist on `AuthApiService` (only `login` / `logout`) and was never used. Removed
   the stale entry.

2. **`ui-toolkit-src-angular/.../message/KSDKMessage.ts`** — `form` exposed only a getter, so
   `message.service.ts` line `existing.form = processedForm` failed to compile **and** would
   throw `Cannot set property form … only a getter` at runtime — i.e. `handleUpdateMessages`
   crashed on any UpdateMessage carrying a form. Added a `set form` setter mirroring the
   getter (consistent with the class's existing `set isIncoming` and `update()` which assign
   `_form`). `message.service.ts` is unchanged as a result.

A `provideHttpClient()` / `provideHttpClientTesting()` was also added to the
`FormMessageComponent` spec's `TestBed`; the existing spec was missing an HTTP provider and
every test in it errored at setup with `No provider for HttpClient!`.

---

## Files changed

| File | Change |
|------|--------|
| `omni-angular/.../form-message/form-message.component.ts` | The fix — `MultiField`/`Composite` default to `{}` |
| `omni-angular/.../form-message/form-message.component.spec.ts` | 15 regression tests + HTTP testing providers in `TestBed` |
| `omni-angular/.../core/facades/app.facade.spec.ts` | Removed nonexistent `getPoolEntry` from spy |
| `omni-angular/.../ui-toolkit-src-angular/.../message/KSDKMessage.ts` | Added `set form` setter (fixes latent compile + runtime crash) |

---

## Developer test cases

Added in `form-message.component.spec.ts`. They pin the contract that a MultiField/Composite
value is **always an object, never a string**.

### `getDefaultFieldValue — MultiField/Composite`
| # | Test | Expectation |
|---|------|-------------|
| 1 | returns empty object for `MultiField` | `{}` |
| 2 | returns empty object for `Composite` | `{}` |
| 3 | MultiField default is a plain object, never a string | `typeof === 'object'`, not `''`, not `null`, not array |
| 4 | Composite default is a plain object, never a string | `typeof === 'object'`, not `''`, not array |
| 5 | returns a fresh object per call | `a !== b` (no shared reference across fields) |
| 6 | other field types not regressed | Text→`''`, PickMany/Checkboxes→`[]`, File→`null` |

### `MultiField value initialization` (real `ngOnInit` path)
| # | Test | Expectation |
|---|------|-------------|
| 7 | untouched MultiField initializes as empty object | `{}` |
| 8 | untouched MultiField is never an empty string | not `''`, `typeof === 'object'` |
| 9 | `null` backend value replaced with empty object | `{}` |
| 10 | existing backend object value preserved | `{ Text1: 'prefilled' }` unchanged |

### `onMultiFieldSubFieldChange — partial fill`
| # | Test | Expectation |
|---|------|-------------|
| 11 | filling one sub-field keeps value an object | `{ Text1: 'hello' }` |
| 12 | value never becomes a string after a sub-field change | `typeof !== 'string'` |

### `onSubmitForm — MultiField answer shape` (end-to-end, the screenshot scenario)
| # | Test | Expectation |
|---|------|-------------|
| 13 | submitting with no sub-fields touched still emits, value stays object | `sendFormData` emitted; value is `{}`, not `''` |

The regression sentinels are the "never a string / never `''`" assertions (#3, #4, #8) — if
anyone reintroduces a `default: return ''` fall-through for these container types, those
tests fail immediately.

---

## How to run

```bash
cd omni-chatbot/src/main/omni-angular
npm install
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  ./node_modules/.bin/ng test --watch=false --browsers=ChromeHeadless \
  --include='src/app/components/form-message/form-message.component.spec.ts'
```

**Result:** `FormMessageComponent` — 62 of 62 SUCCESS (47 existing + 15 new KR-21024 tests).

### Manual verification
1. Open a conversation that asks a form containing a MultiField.
2. Submit the form **without** entering any value in the MultiField sub-fields.
3. Expected: the form submits successfully; the conversation continues.
4. Before the fix: `class java.lang.String cannot be cast to class java.util.Map` and the
   conversation is marked Incomplete.
