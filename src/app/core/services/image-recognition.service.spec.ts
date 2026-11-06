import { signal } from '@angular/core';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { ImageRecognitionService } from './image-recognition.service';

vi.mock('@tensorflow/tfjs', () => ({
  setBackend: vi.fn(async () => true),
  ready: vi.fn(async () => undefined),
}));

vi.mock('@tensorflow-models/mobilenet', () => ({
  load: vi.fn(),
}));

function fakeModel() {
  return { classify: vi.fn(), dispose: vi.fn() };
}

function bare(): ImageRecognitionService & Record<string, any> {
  const service = Object.create(ImageRecognitionService.prototype) as ImageRecognitionService &
    Record<string, any>;
  service.model = null;
  service.modelLoading = signal(false);
  service.modelLoaded = signal(false);
  return service;
}

describe('ImageRecognitionService', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadModel', () => {
    it('loads MobileNet and marks the model as loaded', async () => {
      const model = fakeModel();
      (mobilenet.load as any).mockResolvedValue(model);
      const service = bare();

      await service.loadModel();

      expect(tf.setBackend).toHaveBeenCalledWith('webgl');
      expect(service.model).toBe(model);
      expect(service.modelLoaded()).toBe(true);
      expect(service.modelLoading()).toBe(false);
    });

    it('skips reloading when a model is already present', async () => {
      const service = bare();
      service.model = fakeModel();

      await service.loadModel();

      expect(mobilenet.load).not.toHaveBeenCalled();
    });

    it('skips loading again while a load is already in flight', async () => {
      const service = bare();
      service.modelLoading.set(true);

      await service.loadModel();

      expect(mobilenet.load).not.toHaveBeenCalled();
    });

    it('wraps a load failure and clears the loading flags', async () => {
      (mobilenet.load as any).mockRejectedValue(new Error('webgl unavailable'));
      const service = bare();

      await expect(service.loadModel()).rejects.toThrow('Failed to load image recognition model');
      expect(service.modelLoaded()).toBe(false);
      expect(service.modelLoading()).toBe(false);
    });
  });

  describe('recognizeFood', () => {
    it('loads the model on demand and returns cleaned predictions', async () => {
      const model = fakeModel();
      model.classify.mockResolvedValue([{ className: 'banana, fruit', probability: 0.9 }]);
      (mobilenet.load as any).mockResolvedValue(model);
      const service = bare();
      const canvas = {} as HTMLCanvasElement;

      const predictions = await service.recognizeFood(canvas);

      expect(predictions).toEqual([{ className: 'banana', probability: 0.9 }]);
    });

    it('converts a File source via fileToImage before classifying', async () => {
      const model = fakeModel();
      model.classify.mockResolvedValue([{ className: 'apple', probability: 0.8 }]);
      const service = bare();
      service.model = model;
      const fakeImg = {} as HTMLImageElement;
      service.fileToImage = vi.fn(async () => fakeImg);
      const file = new File(['data'], 'photo.png', { type: 'image/png' });

      const predictions = await service.recognizeFood(file);

      expect(service.fileToImage).toHaveBeenCalledWith(file);
      expect(model.classify).toHaveBeenCalledWith(fakeImg, 5);
      expect(predictions).toEqual([{ className: 'apple', probability: 0.8 }]);
    });

    it('throws when the model still cannot be loaded', async () => {
      (mobilenet.load as any).mockResolvedValue(null);
      const service = bare();
      service.loadModel = vi.fn(async () => {});

      await expect(service.recognizeFood({} as HTMLCanvasElement)).rejects.toThrow('Model not loaded');
    });

    it('wraps a classification failure', async () => {
      const model = fakeModel();
      model.classify.mockRejectedValue(new Error('tensor error'));
      const service = bare();
      service.model = model;

      await expect(service.recognizeFood({} as HTMLCanvasElement)).rejects.toThrow(
        'Failed to recognize food in image'
      );
    });
  });

  describe('recognizeFromCamera', () => {
    it('classifies the video element and returns cleaned predictions', async () => {
      const model = fakeModel();
      model.classify.mockResolvedValue([{ className: 'tomato, vegetable', probability: 0.7 }]);
      const service = bare();
      service.model = model;

      const predictions = await service.recognizeFromCamera({} as HTMLVideoElement);

      expect(predictions).toEqual([{ className: 'tomato', probability: 0.7 }]);
    });

    it('wraps a camera classification failure', async () => {
      const model = fakeModel();
      model.classify.mockRejectedValue(new Error('camera glitch'));
      const service = bare();
      service.model = model;

      await expect(service.recognizeFromCamera({} as HTMLVideoElement)).rejects.toThrow(
        'Failed to recognize food from camera'
      );
    });
  });

  describe('logRecognition', () => {
    it('does nothing when there is no authenticated user', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };
      service.db = { exec: vi.fn() };

      service.logRecognition([{ className: 'apple', probability: 0.9 }], 'apple', 0.9);

      expect(service.db.exec).not.toHaveBeenCalled();
    });

    it('inserts a serialized log row for the current user', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = { exec: vi.fn() };

      service.logRecognition([{ className: 'apple', probability: 0.9 }], 'apple', 0.9, true, 'img.png');

      const [sql, params] = service.db.exec.mock.calls[0];
      expect(sql).toContain('INSERT INTO image_recognition_log');
      expect(params[1]).toBe('u1');
      expect(params[2]).toBe('img.png');
      expect(JSON.parse(params[3])).toEqual([{ className: 'apple', probability: 0.9 }]);
      expect(params[4]).toBe('apple');
      expect(params[5]).toBe(0.9);
      expect(params[6]).toBe(1);
    });
  });

  describe('getRecognitionHistory', () => {
    it('returns an empty list without a user', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };
      service.db = { query: vi.fn() };

      expect(service.getRecognitionHistory()).toEqual([]);
      expect(service.db.query).not.toHaveBeenCalled();
    });

    it('maps stored rows back into recognition results', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = {
        query: vi.fn(() => [
          {
            predictions: JSON.stringify([{ className: 'pear', probability: 0.5 }]),
            selectedLabel: 'pear',
            confidence: 0.5,
            imagePath: 'pear.png',
          },
          { predictions: null, selectedLabel: null, confidence: 0, imagePath: null },
        ]),
      };

      expect(service.getRecognitionHistory(10)).toEqual([
        {
          predictions: [{ className: 'pear', probability: 0.5 }],
          selectedLabel: 'pear',
          confidence: 0.5,
          imagePath: 'pear.png',
        },
        { predictions: [], selectedLabel: null, confidence: 0, imagePath: null },
      ]);
    });
  });

  describe('isFoodRelated', () => {
    it('matches known food keywords case-insensitively', () => {
      const service = bare();
      expect(service.isFoodRelated('Granny Smith Apple')).toBe(true);
      expect(service.isFoodRelated('BANANA')).toBe(true);
    });

    it('rejects unrelated labels', () => {
      const service = bare();
      expect(service.isFoodRelated('sports car')).toBe(false);
    });
  });

  it('exposes a fixed confidence threshold', () => {
    const service = bare();
    expect(service.getConfidenceThreshold()).toBe(0.6);
  });

  describe('dispose', () => {
    it('disposes and clears a loaded model', () => {
      const service = bare();
      const model = fakeModel();
      service.model = model;
      service.modelLoaded.set(true);

      service.dispose();

      expect(model.dispose).toHaveBeenCalled();
      expect(service.model).toBeNull();
      expect(service.modelLoaded()).toBe(false);
    });

    it('is a no-op when there is no model', () => {
      const service = bare();
      expect(() => service.dispose()).not.toThrow();
    });
  });
});
