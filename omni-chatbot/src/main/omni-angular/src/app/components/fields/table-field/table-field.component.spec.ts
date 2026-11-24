import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TableFieldComponent } from './table-field.component';
import { KristaFieldService } from '../../../services/krista-field.service';
import { FormField } from '../../../models/message.model';

/**
 * Regression tests for KR-21136 (table entity columns):
 *
 * An entity-selection column (com.krista.fields.Entity) inside a table must NOT
 * be flattened into manual-entry sub-columns — it renders as a single cell whose
 * editor is the entity SEARCH dialog, mirroring 2.0.16 (SelectionField extends
 * KristaTypeField, not BaseCompositeField) and kristaclient. Flattening produced
 * text inputs whose submitted values carried no primaryKey, which the backend
 * cannot map to an entity record.
 *
 * Also guards: simple columns (text/number) untouched, MultiField/EntityReference
 * flattening preserved, and the table-level search button gated on
 * meta.entity.entityTypeDomain (2.0.16's EntitySelectorMeta.hasEntity).
 */
describe('TableFieldComponent', () => {
  let component: TableFieldComponent;
  let fixture: ComponentFixture<TableFieldComponent>;
  let kristaFieldService: KristaFieldService;

  const ENTITY_TYPE_DOMAIN = {
    entityId: 'e-1',
    entityName: 'Student',
    registry: { invokerId: 'INV_1' }
  };

  const makeEntityColumn = (): FormField => ({
    name: 'Column1',
    fieldType: 'com.krista.fields.Entity',
    attributeValues: {
      selectionSize: 'N',
      invokeAsUser: true,
      entityTypeDomain: ENTITY_TYPE_DOMAIN,
      entityDefinition: {
        name: 'Student',
        fields: {
          Name: { name: 'Name', fieldType: 'com.krista.fields.Text' },
          Age: { name: 'Age', fieldType: 'com.krista.fields.Number' }
        }
      },
      filters: [{ fieldName: 'Name' }]
    }
  });

  const makeTextColumn = (): FormField => ({
    name: 'Notes',
    fieldType: 'com.krista.fields.Text',
    attributeValues: {}
  });

  const makeMultiFieldColumn = (): FormField => ({
    name: 'Contact',
    fieldType: 'com.krista.fields.MultiField',
    attributeValues: {
      fields: [
        { name: 'Phone', fieldType: 'com.krista.fields.Text' },
        { name: 'Email', fieldType: 'com.krista.fields.Text' }
      ]
    }
  });

  const makeEntityReferenceColumn = (): FormField => ({
    name: 'Ref1',
    fieldType: 'com.krista.fields.EntityReference',
    attributeValues: {
      entityDefinition: {
        fields: {
          City: { name: 'City', fieldType: 'com.krista.fields.Text' }
        }
      }
    }
  });

  const makeTableField = (options: {
    columns: FormField[];
    metaEntityAttributes?: { [key: string]: unknown };
    rows?: any[];
  }): FormField => ({
    name: 'Table1',
    fieldType: 'com.krista.fields.Table',
    attributeValues: {
      allowAdd: true,
      allowDelete: true,
      meta: {
        entity: {
          name: 'Entity',
          fieldType: 'com.krista.fields.Entity',
          attributeValues: options.metaEntityAttributes ?? {
            selectionSize: '1',
            invokeAsUser: true
          }
        },
        columns: options.columns.map(field => ({ columnType: 'field', access: 'WRITE', field })),
        headerRows: [],
        footerRows: []
      }
    },
    value: options.rows ? { headers: [], footers: [], rows: options.rows, deletedRows: [] } : undefined
  });

  const initWith = (field: FormField): void => {
    component.field = field;
    fixture.detectChanges(); // triggers ngOnInit -> initializeTable
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [TableFieldComponent],
      providers: [KristaFieldService],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(TableFieldComponent);
    component = fixture.componentInstance;
    kristaFieldService = TestBed.inject(KristaFieldService);
  });

  describe('column flattening (KR-21136)', () => {
    it('keeps an entity-selection column as a single column with full attributes', () => {
      initWith(makeTableField({ columns: [makeEntityColumn(), makeTextColumn()] }));

      const columnNames = component.columns.map(column => column.name);
      expect(columnNames).toEqual(['Column1', 'Notes']);

      const entityColumn = component.columns[0];
      expect(entityColumn.fieldType).toBe('com.krista.fields.Entity');
      // Full attributes must survive — the search dialog depends on them
      expect(entityColumn.attributeValues?.['entityTypeDomain']).toEqual(ENTITY_TYPE_DOMAIN);
      expect(entityColumn.attributeValues?.['entityDefinition']).toBeDefined();
    });

    it('does not create flattened sub-columns (Column1.Name / Column1.Age) for entity columns', () => {
      initWith(makeTableField({ columns: [makeEntityColumn()] }));

      const columnNames = component.columns.map(column => column.name);
      expect(columnNames).not.toContain('Column1.Name');
      expect(columnNames).not.toContain('Column1.Age');
    });

    it('leaves simple text/number columns untouched', () => {
      const numberColumn: FormField = {
        name: 'Score', fieldType: 'com.krista.fields.Number', attributeValues: {}
      };
      initWith(makeTableField({ columns: [makeTextColumn(), numberColumn] }));

      expect(component.columns.map(column => column.name)).toEqual(['Notes', 'Score']);
      expect(component.columns[0].fieldType).toBe('com.krista.fields.Text');
      expect(component.columns[1].fieldType).toBe('com.krista.fields.Number');
    });

    it('still flattens MultiField columns into sub-columns', () => {
      initWith(makeTableField({ columns: [makeMultiFieldColumn()] }));

      expect(component.columns.map(column => column.name))
        .toEqual(['Contact.Phone', 'Contact.Email']);
    });

    it('still flattens EntityReference columns into sub-columns', () => {
      initWith(makeTableField({ columns: [makeEntityReferenceColumn()] }));

      expect(component.columns.map(column => column.name)).toEqual(['Ref1.City']);
    });
  });

  describe('header matrix', () => {
    it('renders an entity column as a single header cell', () => {
      initWith(makeTableField({ columns: [makeEntityColumn(), makeTextColumn()] }));

      // No composite columns -> single header row, one cell per column
      expect(component.headerMatrix.length).toBe(1);
      const headerNames = component.headerMatrix[0].map(cell => cell.name);
      expect(headerNames).toEqual(['Column1', 'Notes']);
      expect(component.headerMatrix[0][0].colSpan).toBe(1);
    });
  });

  describe('table-level entity search gate (2.0.16 hasEntity parity)', () => {
    it('hides the search button when meta.entity lacks entityTypeDomain', () => {
      initWith(makeTableField({
        columns: [makeTextColumn()],
        metaEntityAttributes: { selectionSize: '1', invokeAsUser: true }
      }));

      expect(component.allowEntitySearch).toBeFalse();
    });

    it('shows the search button when meta.entity carries entityTypeDomain', () => {
      initWith(makeTableField({
        columns: [makeTextColumn()],
        metaEntityAttributes: {
          selectionSize: '1',
          invokeAsUser: true,
          entityTypeDomain: ENTITY_TYPE_DOMAIN
        }
      }));

      expect(component.allowEntitySearch).toBeTrue();
      expect(component.entitySelectorMeta?.entityTypeDomain).toEqual(ENTITY_TYPE_DOMAIN as any);
    });
  });

  describe('entity cell value round-trip', () => {
    const entityValue = {
      meta: { primaryKey: 'pk-1', entityType: ENTITY_TYPE_DOMAIN },
      fields: { Name: 'Acme', Age: 30 }
    };

    it('loads an incoming row entity value under the original column name', () => {
      initWith(makeTableField({
        columns: [makeEntityColumn()],
        rows: [{ Column1: entityValue }]
      }));

      expect(component.dataRows.length).toBe(1);
      expect(component.dataRows[0].cells['Column1']).toEqual(entityValue);
    });

    it('builds the cell field with the entity value and full column attributes', () => {
      initWith(makeTableField({
        columns: [makeEntityColumn()],
        rows: [{ Column1: entityValue }]
      }));

      const cellField = component.getCellField(component.dataRows[0], component.columns[0]);
      expect(cellField.fieldType).toBe('com.krista.fields.Entity');
      expect(cellField.value).toEqual(entityValue);
      expect(cellField.attributeValues?.['entityTypeDomain']).toEqual(ENTITY_TYPE_DOMAIN);
    });

    it('submits the selected entity value under the column name', () => {
      // Isolate from @krista/field-types: assert the value is routed through
      // getKristaValue for the ENTITY column and lands under "Column1".
      spyOn(kristaFieldService, 'getKristaValue').and.callFake(
        (_field: any, value: any) => value);
      const emitted: any[] = [];
      initWith(makeTableField({ columns: [makeEntityColumn()] }));
      component.valueChange.subscribe(value => emitted.push(value));

      component.addRow();
      const rowId = component.dataRows[0].rowId;
      component.onCellValueChange(rowId, 'Column1', entityValue);

      const lastValue = emitted[emitted.length - 1];
      expect(lastValue.rows.length).toBe(1);
      expect(lastValue.rows[0]['Column1']).toEqual(entityValue);
      expect(kristaFieldService.getKristaValue).toHaveBeenCalledWith(
        jasmine.objectContaining({ fieldType: 'com.krista.fields.Entity' }), entityValue);
    });
  });
});
