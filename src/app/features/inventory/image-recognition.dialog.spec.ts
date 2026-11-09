import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { ImageRecognitionDialog } from './image-recognition.dialog';
import { ImageRecognitionService } from '../../core/services/image-recognition.service';
import { SnackbarService } from '../../core/services/snackbar.service';

class FakeImage {
  onload: (() => void) | null = null;
  onerror: ((err?: unknown) => void) | null = null;
  private _src = '';
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
  get src() {
    return this._src;
  }
}

describe('ImageRecognitionDialog', () => {
  let fixture: ComponentFixture<ImageRecognitionDialog>;
  let component: ImageRecognitionDialog;
  let recognitionSpy: {
    preloadModel: ReturnType<typeof vi.fn>;
    recognizeFood: ReturnType<typeof vi.fn>;
    getConfidenceThreshold: ReturnType<typeof vi.fn>;
    isFoodRelated: ReturnType<typeof vi.fn>;
    logRecognition: ReturnType<typeof vi.fn>;
  };
  let snackbarSpy: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    recognitionSpy = {
      preloadModel: vi.fn(),
      recognizeFood: vi.fn().mockResolvedValue([]),
      getConfidenceThreshold: vi.fn().mockReturnValue(0.5),
      isFoodRelated: vi.fn().mockReturnValue(true),
      logRecognition: vi.fn(),
    };
    snackbarSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    dialogRefSpy = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ImageRecognitionDialog, MatIconTestingModule],
      providers: [
        { provide: ImageRecognitionService, useValue: recognitionSpy },
        { provide: SnackbarService, useValue: snackbarSpy },
        { provide: MatDialogRef, useValue: dialogRefSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ImageRecognitionDialog);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('preloads the recognition model on init', () => {
    component.ngOnInit();
    expect(recognitionSpy.preloadModel).toHaveBeenCalled();
  });

  it('stops the camera on destroy', () => {
    const stop = vi.fn();
    (component as any).mediaStream = { getTracks: () => [{ stop }] };
    component.cameraActive.set(true);

    component.ngOnDestroy();

    expect(stop).toHaveBeenCalled();
    expect(component.cameraActive()).toBe(false);
  });

  describe('startCamera', () => {
    it('activates the camera and assigns the stream to the video element', async () => {
      vi.useFakeTimers();
      let srcObject: MediaStream | null = null;
      const videoEl = {
        set srcObject(v: MediaStream | null) { srcObject = v; },
        get srcObject() { return srcObject; },
      } as unknown as HTMLVideoElement;
      component.videoElement = { nativeElement: videoEl } as any;
      const stream = { getTracks: () => [] } as unknown as MediaStream;
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
      });

      const promise = component.startCamera();
      await promise;
      expect(component.cameraActive()).toBe(true);

      await vi.advanceTimersByTimeAsync(100);
      expect(srcObject).toBe(stream);
      vi.useRealTimers();
    });

    it('shows an error and leaves the camera inactive when access is denied', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: vi.fn().mockRejectedValue(new Error('denied')) },
      });

      await component.startCamera();

      expect(component.cameraActive()).toBe(false);
      expect(snackbarSpy.error).toHaveBeenCalledWith('Failed to access camera. Please check permissions.');
    });
  });

  describe('stopCamera', () => {
    it('stops every track and clears camera state', () => {
      const stop = vi.fn();
      (component as any).mediaStream = { getTracks: () => [{ stop }, { stop }] };
      component.cameraActive.set(true);

      component.stopCamera();

      expect(stop).toHaveBeenCalledTimes(2);
      expect(component.cameraActive()).toBe(false);
    });

    it('is a no-op when there is no active stream', () => {
      expect(() => component.stopCamera()).not.toThrow();
      expect(component.cameraActive()).toBe(false);
    });
  });

  describe('captureImage', () => {
    it('does nothing without a resolved video element', async () => {
      await component.captureImage();
      expect(component.imageSource()).toBe('');
    });

    it('captures a frame, stops the camera, and triggers recognition', async () => {
      vi.stubGlobal('Image', FakeImage);
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as any);
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,abc');
      recognitionSpy.recognizeFood.mockResolvedValue([{ className: 'apple', probability: 0.9 }]);
      const stopSpy = vi.spyOn(component, 'stopCamera');
      component.videoElement = { nativeElement: { videoWidth: 100, videoHeight: 100 } } as any;

      await component.captureImage();

      expect(component.imageSource()).toBe('data:image/jpeg;base64,abc');
      expect(stopSpy).toHaveBeenCalled();
      expect(component.predictions()).toEqual([{ className: 'apple', probability: 0.9 }]);
    });

    it('does nothing when the canvas context is unavailable', async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
      component.videoElement = { nativeElement: { videoWidth: 100, videoHeight: 100 } } as any;

      await component.captureImage();

      expect(component.imageSource()).toBe('');
    });
  });

  describe('onFileSelected', () => {
    it('does nothing when no file was chosen', async () => {
      const event = { target: { files: [] } } as unknown as Event;
      await component.onFileSelected(event);
      expect(component.imageSource()).toBe('');
    });
  });

  describe('recognizeImage', () => {
    it('does nothing without an image source', async () => {
      await component.recognizeImage();
      expect(recognitionSpy.recognizeFood).not.toHaveBeenCalled();
    });

    it('auto-selects the top prediction when confidence meets the threshold', async () => {
      vi.stubGlobal('Image', FakeImage);
      recognitionSpy.getConfidenceThreshold.mockReturnValue(0.5);
      recognitionSpy.recognizeFood.mockResolvedValue([{ className: 'apple', probability: 0.9 }]);
      component.imageSource.set('data:image/jpeg;base64,abc');

      await component.recognizeImage();

      expect(component.selectedPrediction()).toBe('apple');
      expect(snackbarSpy.success).toHaveBeenCalledWith('Detected 1 possible items');
      expect(component.recognizing()).toBe(false);
    });

    it('does not auto-select a prediction below the confidence threshold', async () => {
      vi.stubGlobal('Image', FakeImage);
      recognitionSpy.getConfidenceThreshold.mockReturnValue(0.9);
      recognitionSpy.recognizeFood.mockResolvedValue([{ className: 'apple', probability: 0.3 }]);
      component.imageSource.set('data:image/jpeg;base64,abc');

      await component.recognizeImage();

      expect(component.selectedPrediction()).toBeNull();
    });

    it('warns when no food items are detected', async () => {
      vi.stubGlobal('Image', FakeImage);
      recognitionSpy.recognizeFood.mockResolvedValue([]);
      component.imageSource.set('data:image/jpeg;base64,abc');

      await component.recognizeImage();

      expect(snackbarSpy.warning).toHaveBeenCalledWith('No food items detected in image');
    });

    it('shows a failure snackbar when the image fails to load', async () => {
      class FailingImage extends FakeImage {
        override set src(value: string) {
          queueMicrotask(() => this.onerror?.(new Error('decode error')));
        }
      }
      vi.stubGlobal('Image', FailingImage);
      component.imageSource.set('data:image/jpeg;base64,abc');

      await component.recognizeImage();

      expect(snackbarSpy.error).toHaveBeenCalledWith('Failed to analyze image');
      expect(component.recognizing()).toBe(false);
    });
  });

  describe('selectPrediction', () => {
    it('sets the selected prediction', () => {
      component.selectPrediction({ className: 'banana', probability: 0.8 } as any);
      expect(component.selectedPrediction()).toBe('banana');
    });
  });

  describe('isFoodRelated', () => {
    it('is false when nothing is selected', () => {
      expect(component.isFoodRelated()).toBe(false);
      expect(recognitionSpy.isFoodRelated).not.toHaveBeenCalled();
    });

    it('delegates to the recognition service once a prediction is selected', () => {
      component.selectedPrediction.set('apple');
      expect(component.isFoodRelated()).toBe(true);
      expect(recognitionSpy.isFoodRelated).toHaveBeenCalledWith('apple');
    });
  });

  describe('resetCapture', () => {
    it('clears capture state', () => {
      component.imageSource.set('data:x');
      component.predictions.set([{ className: 'apple', probability: 0.9 } as any]);
      component.selectedPrediction.set('apple');
      component.recognitionAttempted.set(true);

      component.resetCapture();

      expect(component.imageSource()).toBe('');
      expect(component.predictions()).toEqual([]);
      expect(component.selectedPrediction()).toBeNull();
      expect(component.recognitionAttempted()).toBe(false);
    });
  });

  describe('onConfirm', () => {
    it('does nothing when nothing is selected', () => {
      component.onConfirm();
      expect(dialogRefSpy.close).not.toHaveBeenCalled();
    });

    it('logs the recognition and closes with the selected label', () => {
      component.predictions.set([{ className: 'apple', probability: 0.9 } as any]);
      component.selectedPrediction.set('apple');

      component.onConfirm();

      expect(recognitionSpy.logRecognition).toHaveBeenCalledWith(
        [{ className: 'apple', probability: 0.9 }],
        'apple',
        0.9
      );
      expect(dialogRefSpy.close).toHaveBeenCalledWith('apple');
    });

    it('falls back to a zero probability when the selected label was typed manually', () => {
      component.selectedPrediction.set('apple');

      component.onConfirm();

      expect(recognitionSpy.logRecognition).toHaveBeenCalledWith([], 'apple', 0);
    });
  });

  describe('onCancel', () => {
    it('stops the camera and closes with null', () => {
      const stopSpy = vi.spyOn(component, 'stopCamera');
      component.onCancel();
      expect(stopSpy).toHaveBeenCalled();
      expect(dialogRefSpy.close).toHaveBeenCalledWith(null);
    });
  });
});
