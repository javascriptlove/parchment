import { Blot, Parent, Leaf } from './blot';
import LinkedList from '../../collection/linked-list';
import ShadowBlot from './shadow';
import * as Registry from '../../registry';


abstract class ContainerBlot extends ShadowBlot implements Parent {
  static child: string;

  children: LinkedList<Blot>;
  domNode: HTMLElement;

  constructor(domNode: HTMLElement) {
    super(domNode);
    this.build();
  }

  appendChild(other: Blot): void {
    this.insertBefore(other);
  }

  build(): void {
    this.children = new LinkedList<Blot>();
    // Need to be reversed for if DOM nodes already in order
    [].slice.call(this.domNode.childNodes).reverse().forEach((node) => {
      try {
        let child = Registry.find(node) || Registry.create(node);
        this.insertBefore(child, this.children.head);
      } catch (skipBlot) { }
    });
  }

  deleteAt(index: number, length: number): void {
    if (index === 0 && length === this.length()) {
      this.remove();
    } else {
      this.children.forEachAt(index, length, function(child, offset, length) {
        child.deleteAt(offset, length);
      });
    }
  }

  descendants<T>(type: { new (): T; }, index: number = 0, length: number = this.length()): T[] {
    let descendants = [];
    this.children.forEachAt(index, length, function(child) {
      if (child instanceof type) {
        descendants.push(child);
      }
      if (child instanceof ContainerBlot) {
        descendants = descendants.concat(child.descendants(type, index, length));
      }
    });
    return descendants;
  }

  findNode(index: number, inclusive: boolean = false): [Node, number] {
    let [child, offset] = this.children.find(index, inclusive);
    return child.findNode(offset, inclusive);
  }

  findOffset(node: Node): number {
    if (node === this.domNode) return 0;
    let blot = Registry.find(node);
    if (blot == null || blot.parent !== this) return -1;
    return this.children.offset(blot);
  }

  formatAt(index: number, length: number, name: string, value: any): void {
    this.children.forEachAt(index, length, function(child, offset, length) {
      child.formatAt(offset, length, name, value);
    });
  }

  insertAt(index: number, value: string, def?: any): void {
    let [child, offset] = this.children.find(index);
    if (child) {
      child.insertAt(offset, value, def);
    } else {
      let blot = (def == null) ? Registry.create('text', value) : Registry.create(value, def);
      this.appendChild(blot);
    }
  }

  insertBefore(childBlot: Blot, refBlot?: Blot): void {
    childBlot.insertInto(this, refBlot);
  }

  length(): number {
    return this.children.reduce(function(memo, child) {
      return memo + child.length();
    }, 0);
  }

  moveChildren(targetParent: Parent, refNode?: Blot): void {
    this.children.forEach(function(child) {
      targetParent.insertBefore(child, refNode);
    });
  }

  optimize() {
    super.optimize();
    if (this.children.length === 0) {
      if (this.statics.child != null) {
        let args = typeof this.statics.child === 'string' ? [this.statics.child] : this.statics.child;
        let child = Registry.create.apply(Registry, args);
        this.appendChild(child);
        child.optimize();
      } else {
        this.remove();
      }
    }
  }

  path(index: number, inclusive: boolean = false): [Blot, number][] {
    let [child, offset] = this.children.find(index, inclusive);
    if (child == null) return [[this, index]];
    let position: [Blot, number][] = [[this, index - offset]];
    if (child instanceof ContainerBlot) {
      return position.concat(child.path(offset, inclusive));
    } else {
      position.push([child, offset]);
    }
    return position;
  }

  replace(target: Parent): void {
    target.moveChildren(this);
    super.replace(target);
  }

  split(index: number, force: boolean = false): Blot {
    if (!force) {
      if (index === 0) return this;
      if (index === this.length()) return this.next;
    }
    let after = <ContainerBlot>this.clone();
    this.parent.insertBefore(after, this.next);
    this.children.forEachAt(index, this.length(), function(child, offset, length) {
      child = child.split(offset, force);
      after.appendChild(child);
    });
    return after;
  }

  unwrap(): void {
    this.moveChildren(this.parent, this.next);
    this.remove();
  }

  update(mutations: MutationRecord[]): void {
    let updated = mutations.some((mutation) => {
      return mutation.target === this.domNode && mutation.type === 'childList';
    });
    if (updated) {
      let childNode = this.domNode.firstChild;
      this.children.forEach((child) => {
        while (childNode !== child.domNode) {
          if (child.domNode.parentNode === this.domNode) {
            // New child inserted
            let blot = Registry.find(childNode) || Registry.create(childNode);
            if (blot.parent != null) {
              blot.parent.children.remove(blot);
            }
            this.insertBefore(blot, child);
            childNode = childNode.nextSibling;
          } else {
            // Existing child removed
            return child.remove();
          }
        }
        childNode = childNode.nextSibling;
      });
      while (childNode != null) {
        let blot = Registry.find(childNode) || Registry.create(childNode);
        this.insertBefore(blot);
        childNode = childNode.nextSibling;
      }
    }
  }

  // wrap(name: string, value: any): ParentBlot {
  //   if (name === this.statics.blotName) {
  //     return this.replaceWith(name, value);
  //   } else {
  //     return super.wrap(name, value);
  //   }
  // }
}


export default ContainerBlot;
