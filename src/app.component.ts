import { Component, ChangeDetectionStrategy, signal, ElementRef, viewChild, afterNextRender, computed } from '@angular/core';

// Represents the raw geometry of a shape
interface BaseShape {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

type ShapeType = 'square' | 'circle';

// Represents a fully styled shape for rendering
interface Shape extends BaseShape {
  color: string;
  type: ShapeType;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class AppComponent {
  // --- STATE SIGNALS ---

  // Style Controls
  colors = signal<string[]>(['#1B998B', '#2D3047', '#FFFD82', '#FF9B71', '#E84855']);
  whiteSpace = signal<number>(20); // Percentage from 0 to 90
  shapeType = signal<ShapeType>('square');
  
  // Geometry Controls
  minShapeSize = signal<number>(30);
  maxShapeSize = signal<number>(150);

  // Transform Controls
  scale = signal<number>(1);
  rotation = signal<number>(0);

  // Internal State
  private baseShapes = signal<BaseShape[]>([]);
  private shuffledIndices = signal<number[]>([]);
  
  // --- DERIVED STATE (COMPUTED SIGNAL) ---

  // This computed signal reactively combines geometry and styles.
  // It only re-calculates when one of its dependencies changes.
  generatedShapes = computed(() => {
    const base = this.baseShapes();
    const indices = this.shuffledIndices();
    const colors = this.colors();
    const whiteSpace = this.whiteSpace();
    const shapeType = this.shapeType();

    if (base.length === 0) return [];
    
    const numToMakeWhite = Math.floor(base.length * (whiteSpace / 100));
    const whiteIndices = new Set(indices.slice(0, numToMakeWhite));

    // Handle case where user removes all colors
    const effectiveColors = colors.length > 0 ? colors : ['#cccccc'];

    return base.map((shape) => ({
      ...shape,
      type: shapeType,
      // Assign white color or a stable color from the palette
      color: whiteIndices.has(shape.id) 
        ? '#ffffff' 
        : effectiveColors[shape.id % effectiveColors.length],
    }));
  });

  // Canvas element reference to get dimensions
  canvas = viewChild<ElementRef<HTMLDivElement>>('canvas');
  private canvasWidth = 0;
  private canvasHeight = 0;
  private shapeIdCounter = 0;

  constructor() {
    afterNextRender(() => {
      this.regenerateLayout();
    });
  }

  // --- UPDATE METHODS ---

  // Style-only updates: just change the signal
  updateColor(index: number, event: Event): void {
    const newColor = (event.target as HTMLInputElement).value;
    this.colors.update(currentColors => {
      const updatedColors = [...currentColors];
      updatedColors[index] = newColor;
      return updatedColors;
    });
  }

  updateWhiteSpace(event: Event): void {
    this.whiteSpace.set(parseInt((event.target as HTMLInputElement).value, 10));
  }

  updateShapeType(event: Event): void {
    this.shapeType.set((event.target as HTMLSelectElement).value as ShapeType);
  }

  // Transform-only updates: just change the signal
  updateScale(event: Event): void {
    this.scale.set(parseFloat((event.target as HTMLInputElement).value));
  }

  updateRotation(event: Event): void {
    this.rotation.set(parseInt((event.target as HTMLInputElement).value, 10));
  }

  // Geometry updates: change signal and regenerate layout
  updateMinShapeSize(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.minShapeSize.set(value);
    if (this.maxShapeSize() < value) {
      this.maxShapeSize.set(value);
    }
    this.regenerateLayout();
  }

  updateMaxShapeSize(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.maxShapeSize.set(value);
    if (this.minShapeSize() > value) {
      this.minShapeSize.set(value);
    }
    this.regenerateLayout();
  }

  // --- CORE LOGIC ---

  regenerateLayout(): void {
    const canvasEl = this.canvas()?.nativeElement;
    if (!canvasEl) return;

    this.canvasWidth = canvasEl.offsetWidth;
    this.canvasHeight = canvasEl.offsetHeight;
    this.shapeIdCounter = 0;
    
    const newBaseShapes: BaseShape[] = [];

    const partition = (x: number, y: number, width: number, height: number) => {
        const minSize = this.minShapeSize();
        const maxSize = this.maxShapeSize();
        
        const canSplitHorizontally = height >= minSize * 2;
        const canSplitVertically = width >= minSize * 2;
        
        const shouldStop = width <= maxSize && height <= maxSize && Math.random() > 0.1;

        if (shouldStop || (!canSplitHorizontally && !canSplitVertically)) {
            newBaseShapes.push({
                id: this.shapeIdCounter++, x, y, width, height
            });
            return;
        }

        const splitVertically = (width > height && canSplitVertically) || !canSplitHorizontally;
        
        if (splitVertically) {
            const splitPoint = minSize + Math.random() * (width - (minSize * 2));
            const splitX = Math.round(splitPoint);
            partition(x, y, splitX, height);
            partition(x + splitX, y, width - splitX, height);
        } else { // Split horizontally
            const splitPoint = minSize + Math.random() * (height - (minSize * 2));
            const splitY = Math.round(splitPoint);
            partition(x, y, width, splitY);
            partition(x, y + splitY, width, height - splitY);
        }
    };

    partition(0, 0, this.canvasWidth, this.canvasHeight);
    this.baseShapes.set(newBaseShapes);
    
    // Create and store a shuffled list of indices for stable white space application
    const indices = Array.from({ length: newBaseShapes.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    this.shuffledIndices.set(indices.map(idx => this.baseShapes()[idx].id));
  }
}
