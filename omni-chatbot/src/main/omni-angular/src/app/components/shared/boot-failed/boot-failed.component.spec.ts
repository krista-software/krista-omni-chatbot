import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { BootFailedComponent } from './boot-failed.component';

/**
 * Guards the two things this component is responsible for: emitting the user's
 * choice, and rendering both actions. A boot failure is unrecoverable without
 * them — losing the retry button would strand the user with no way forward.
 */
describe('BootFailedComponent', () => {
  let component: BootFailedComponent;
  let fixture: ComponentFixture<BootFailedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [BootFailedComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(BootFailedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits retry when the retry button is clicked', () => {
    spyOn(component.retry, 'emit');

    fixture.nativeElement.querySelector('.reconnect-btn').click();

    expect(component.retry.emit).toHaveBeenCalled();
  });

  it('emits close when the close button is clicked', () => {
    spyOn(component.close, 'emit');

    fixture.nativeElement.querySelector('.close-btn').click();

    expect(component.close.emit).toHaveBeenCalled();
  });

  it('renders both actions', () => {
    expect(fixture.nativeElement.querySelector('.reconnect-btn')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.close-btn')).not.toBeNull();
  });

  // Screen readers announce this as a modal alert; losing the role would make the
  // failure silent for assistive technology.
  it('exposes the notice as an alertdialog', () => {
    const overlay = fixture.nativeElement.querySelector('.disconnected-overlay');

    expect(overlay.getAttribute('role')).toBe('alertdialog');
    expect(overlay.getAttribute('aria-modal')).toBe('true');
  });
});
