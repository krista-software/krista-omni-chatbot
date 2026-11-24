import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FieldsModule } from '../app/components/fields/fields.module';
import { FormField } from '../app/models/message.model';
import { FileFieldConfig } from '../app/models/field-config.model';

type FieldKind = 'pick-one' | 'pick-many' | 'switch' | 'file' | 'rating' | 'date-range';

interface VisualCase {
  /** Stable screenshot id — also the baseline filename. */
  id: string;
  kind: FieldKind;
  /** true renders inside an outgoing (brand-coloured) bubble. */
  outgoing: boolean;
  field: FormField;
  /** FileFieldConfig is the widest of the field configs, so one shape drives them all. */
  config: FileFieldConfig;
}

/**
 * Visual-regression harness.
 *
 * <p>Renders the real field components — not copies of their markup — inside a
 * replica of the chat bubble, so screenshots capture what a user actually sees.
 * Only the surrounding bubble chrome is reproduced here; every field is the
 * production component with production styles.
 *
 * <p>Built through the separate {@code visual} configuration in angular.json, so
 * nothing in this folder is reachable from the shipped application bundle.
 *
 * <p>Each case is wrapped in a fixed-width {@code .vt-case} carrying a
 * {@code data-vt} attribute. The Playwright runner screenshots those elements
 * individually rather than the whole page, which keeps diffs local to the field
 * that actually changed.
 */
@Component({
  selector: 'app-visual-harness',
  standalone: true,
  imports: [CommonModule, FieldsModule],
  templateUrl: './visual-harness.component.html',
  styleUrls: ['./visual-harness.component.css']
})
export class VisualHarnessComponent {

  private readonly allCases: VisualCase[] = this.buildCases();

  /**
   * Cases to render. With {@code ?case=<id>} only that one is rendered.
   *
   * <p>The runner screenshots one case per page load. Rendering everything at
   * once let a height change in one case shift the others, whose text then
   * rasterised at different sub-pixel offsets — a single-field regression
   * reported 21 of 24 cases as changed. Isolation keeps a diff attributable to
   * the field that actually changed.
   */
  readonly cases: VisualCase[] = this.selectCases();

  /** Ids exposed on window so the runner can enumerate without rendering all. */
  private selectCases(): VisualCase[] {
    (window as any).__vtCaseIds = this.allCases.map(c => c.id);
    const requested = new URLSearchParams(window.location.search).get('case');
    if (!requested) {
      return this.allCases;
    }
    return this.allCases.filter(c => c.id === requested);
  }

  private buildCases(): VisualCase[] {
    const kinds: FieldKind[] = ['pick-one', 'pick-many', 'switch', 'file', 'rating', 'date-range'];
    const cases: VisualCase[] = [];
    for (const kind of kinds) {
      for (const readOnly of [false, true]) {
        for (const outgoing of [false, true]) {
          const state = readOnly ? 'readonly' : 'editable';
          const bubble = outgoing ? 'outgoing' : 'incoming';
          cases.push({
            id: `${kind}--${state}--${bubble}`,
            kind,
            outgoing,
            field: this.fieldFor(kind, readOnly),
            config: {
              hasError: false,
              errorMessage: '',
              readOnly,
              workspaceId: 'vt-workspace',
              clientSessionId: 'vt-session'
            }
          });
        }
      }
    }
    return cases;
  }

  /** Fixed fixture data — no randomness, no dates derived from "now". */
  private fieldFor(kind: FieldKind, readOnly: boolean): FormField {
    const base = {
      fieldId: `vt-${kind}`,
      name: `vt_${kind.replace('-', '_')}`,
      required: true,
      readOnly
    };
    switch (kind) {
      case 'pick-one':
        return {
          ...base,
          fieldType: 'com.krista.fields.PickOne',
          label: 'Pick one1',
          value: 'Option3',
          attributeValues: { options: ['Option1', 'Option2', 'Option3'] }
        } as FormField;
      case 'pick-many':
        return {
          ...base,
          fieldType: 'com.krista.fields.PickMany',
          label: 'Pick list1',
          value: ['Option1', 'Option3'],
          attributeValues: { options: ['Option1', 'Option2', 'Option3'] }
        } as FormField;
      case 'switch':
        return {
          ...base,
          fieldType: 'com.krista.fields.Switch',
          label: 'Switch1',
          value: true
        } as FormField;
      case 'file':
        return {
          ...base,
          fieldType: 'com.krista.fields.File',
          label: 'File1',
          value: null
        } as FormField;
      case 'rating':
        return {
          ...base,
          fieldType: 'com.krista.fields.Rating',
          label: 'Rating1',
          value: 3,
          attributeValues: { maxRating: 5 }
        } as FormField;
      case 'date-range':
        return {
          ...base,
          fieldType: 'com.krista.fields.DateRange',
          label: 'Date range1',
          value: { start: '2026-01-15', end: '2026-01-20' }
        } as FormField;
    }
  }
}
