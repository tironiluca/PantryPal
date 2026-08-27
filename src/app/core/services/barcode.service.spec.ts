import { TestBed } from '@angular/core/testing';
import { BrowserMultiFormatReader } from '@zxing/library';
import { BarcodeService } from './barcode.service';

describe('BarcodeService', () => {
  let service: BarcodeService;
  let video: HTMLVideoElement;
  let reset: ReturnType<typeof vi.spyOn>;
  let decodeFromVideoDevice: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [BarcodeService] });
    service = TestBed.inject(BarcodeService);
    video = document.createElement('video');
    delete (window as any).BarcodeDetector;
    reset = vi.spyOn(BrowserMultiFormatReader.prototype, 'reset').mockImplementation(() => undefined);
    decodeFromVideoDevice = vi.spyOn(BrowserMultiFormatReader.prototype, 'decodeFromVideoDevice');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resets ZXing after a successful decode', async () => {
    decodeFromVideoDevice.mockImplementation((_device, _video, callback) => {
      callback({ getText: () => '0123456789012' }, undefined);
      return Promise.resolve();
    });

    await expect(service.scan(video)).resolves.toBe('0123456789012');
    expect(reset).toHaveBeenCalledOnce();
  });

  it('resets ZXing when the scan times out', async () => {
    vi.useFakeTimers();
    decodeFromVideoDevice.mockReturnValue(new Promise(() => undefined));

    const scan = service.scan(video);
    await vi.advanceTimersByTimeAsync(10000);

    await expect(scan).resolves.toBeNull();
    expect(reset).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('resets ZXing when initialization fails', async () => {
    decodeFromVideoDevice.mockRejectedValue(new Error('camera unavailable'));

    await expect(service.scan(video)).rejects.toThrow('Failed to initialize barcode scanner');
    expect(reset).toHaveBeenCalledOnce();
  });

  it('cancels ZXing and stops its camera tracks', async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] };
    decodeFromVideoDevice.mockImplementation((_device, videoElement) => {
      videoElement.srcObject = stream as unknown as MediaStream;
      return new Promise(() => undefined);
    });

    const scan = service.scan(video);
    service.cancel();

    expect(reset).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    await expect(scan).resolves.toBeNull();
  });

  it('stops every native camera track after a successful decode', async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] };
    const detect = vi.fn().mockResolvedValue([{ rawValue: '1234567890123' }]);
    const play = vi.spyOn(video, 'play').mockResolvedValue(undefined);

    Object.defineProperty(window, 'BarcodeDetector', {
      configurable: true,
      value: class {
        detect = detect;
      },
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({}));

    await expect(service.scan(video)).resolves.toBe('1234567890123');
    expect(stop).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
    delete (window as any).BarcodeDetector;
  });

  it('cancels native scanning and stops every camera track', async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] };
    const detect = vi.fn().mockResolvedValue([]);
    const play = vi.spyOn(video, 'play').mockResolvedValue(undefined);

    Object.defineProperty(window, 'BarcodeDetector', {
      configurable: true,
      value: class {
        detect = detect;
      },
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({}));

    const scan = service.scan(video);
    await vi.waitFor(() => expect(detect).toHaveBeenCalled());
    service.cancel();

    await expect(scan).resolves.toBeNull();
    expect(stop).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledOnce();
  });
});
