import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { StatusOverlayComponent } from './status-overlay.component';

describe('StatusOverlayComponent', () => {
  let component: StatusOverlayComponent;
  let fixture: ComponentFixture<StatusOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [StatusOverlayComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(StatusOverlayComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => component.ngOnDestroy());

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('shows one of the provided messages on init', () => {
    component.messages = ['Loading...', 'Almost there...'];
    fixture.detectChanges();
    expect(component.messages).toContain(component.currentMessage);
    expect(component.textVisible).toBe(true);
  });

  it('renders no text when there are no messages', () => {
    component.messages = [];
    fixture.detectChanges();
    expect(component.currentMessage).toBe('');
  });

  it('exposes the imageUrl input for the template binding', () => {
    component.messages = ['x'];
    component.imageUrl = 'https://example.test/icon.png';
    fixture.detectChanges();
    expect(component.imageUrl).toBe('https://example.test/icon.png');
  });
});
