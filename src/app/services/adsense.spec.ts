import { TestBed } from '@angular/core/testing';

import { AdsenseService } from './adsense';

describe('AdsenseService', () => {
  let service: AdsenseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdsenseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
