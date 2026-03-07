import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FrescobolTimer } from './frescobol-timer';

describe('FrescobolTimer', () => {
  let component: FrescobolTimer;
  let fixture: ComponentFixture<FrescobolTimer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FrescobolTimer],
    }).compileComponents();

    fixture = TestBed.createComponent(FrescobolTimer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
