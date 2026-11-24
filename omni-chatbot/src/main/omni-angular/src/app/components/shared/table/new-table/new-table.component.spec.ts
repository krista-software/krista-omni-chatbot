import { ChangeDetectorRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { NewTableComponent } from './new-table.component';
import { TableRow } from '../TableRow';
import { TableValueCell } from '../TableValueCell';

/**
 * Regression tests for the KR-21136 UI hard-freeze:
 *
 * selectRowsByKeys() iterated the LIVE activeSelection Set while
 * onRowSelect() (selection == "SINGLE") cleared and re-added the same key
 * into it. Per JS Set semantics, a value removed and re-added during for..of
 * is visited AGAIN by the active iterator — an infinite synchronous loop that
 * froze the whole UI (entity cell record selected in a table + submit).
 *
 * NOTE: if the snapshot fix regresses, the SINGLE-selection test below does
 * not "fail" an assertion — it hangs the browser and karma reports a
 * disconnect/timeout. That is the loud, intended failure mode.
 */
describe('NewTableComponent selectRowsByKeys', () => {
  let component: NewTableComponent;

  const makeComponent = (selection: 'SINGLE' | 'MULTI SELECT'): NewTableComponent => {
    const cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['detectChanges', 'markForCheck']);
    const dialog = {} as MatDialog;
    const instance = new NewTableComponent(cdr, dialog);
    instance.tableInput = {
      tableConfig: { selection, pageSize: 10 },
      dataSource: {}
    } as any;
    return instance;
  };

  const makeRow = (key: string): TableRow<TableValueCell> =>
    new TableRow<TableValueCell>(key, []);

  it('terminates with SINGLE selection when the selected key is re-selected (freeze regression)', () => {
    component = makeComponent('SINGLE');
    const row = makeRow('pk-1');
    component.activeSelection = new Set(['pk-1']);

    // Before the snapshot fix this call never returned: onRowSelect cleared
    // activeSelection and re-added 'pk-1' while the for..of was iterating it.
    component.selectRowsByKeys([row], component.activeSelection);

    expect(Array.from(component.activeSelection)).toEqual(['pk-1']);
    expect(component.selection.selected).toContain(row);
  });

  it('re-selects all keys with MULTI SELECT', () => {
    component = makeComponent('MULTI SELECT');
    const rowA = makeRow('pk-a');
    const rowB = makeRow('pk-b');
    component.activeSelection = new Set(['pk-a', 'pk-b']);

    component.selectRowsByKeys([rowA, rowB], component.activeSelection);

    expect(Array.from(component.activeSelection).sort()).toEqual(['pk-a', 'pk-b']);
    expect(component.selection.selected).toContain(rowA);
    expect(component.selection.selected).toContain(rowB);
  });

  it('leaves selection untouched when the key has no matching row', () => {
    component = makeComponent('SINGLE');
    component.activeSelection = new Set(['pk-missing']);

    component.selectRowsByKeys([makeRow('pk-other')], component.activeSelection);

    expect(component.selection.selected.length).toBe(0);
    // The stale key remains (pre-existing behavior — only the freeze is fixed)
    expect(component.activeSelection.has('pk-missing')).toBeTrue();
  });
});
