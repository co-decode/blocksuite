import type { BaseBlockModel } from '@blocksuite/store';
import type { LeafBlot } from 'parchment';
import type { DefaultPageBlockComponent, SelectedBlock } from '../../index.js';
import type { RichText } from '../rich-text/rich-text.js';
import { BLOCK_ID_ATTR as ATTR } from '@blocksuite/global/config';
import type { IPoint } from './gesture.js';
import { assertExists, matchFlavours } from '@blocksuite/global/utils';

type ElementTagName = keyof HTMLElementTagNameMap;

interface ContainerBlock {
  model?: BaseBlockModel;
}

export function getBlockById<T extends ElementTagName>(
  id: string,
  container: Element = document.body
) {
  return container.querySelector<T>(`[${ATTR}="${id}"]` as T);
}

export function getBlockByPoint(point: IPoint): Element | null | undefined {
  return document.elementFromPoint(point.x, point.y)?.closest(`[${ATTR}]`);
}

/**
 * @deprecated Use `page.getParent` instead
 */
export function getParentBlockById<T extends ElementTagName>(
  id: string,
  ele: Element = document.body
) {
  const currentBlock = getBlockById<T>(id, ele);
  return currentBlock?.parentElement?.closest<T>(`[${ATTR}]` as T) || null;
}

/**
 *
 * @example
 * ```md
 * page
 * - frame
 *  - paragraph <- when invoked here, the traverse order will be following
 *    - child <- 1
 *  - sibling <- 2
 * - frame <- 3 (will be skipped)
 *   - paragraph <- 4
 * ```
 *
 * NOTE: this method will skip the `affine:frame` block
 */
export function getNextBlock(
  model: BaseBlockModel,
  map: Record<string, true> = {}
): BaseBlockModel | null {
  if (model.id in map) {
    throw new Error("Can't get next block! There's a loop in the block tree!");
  }
  map[model.id] = true;

  const page = model.page;
  if (model.children.length) {
    return model.children[0];
  }
  let currentBlock: typeof model | null = model;
  while (currentBlock) {
    const nextSibling = page.getNextSibling(currentBlock);
    if (nextSibling) {
      // Assert nextSibling is not possible to be `affine:page`
      if (matchFlavours(nextSibling, ['affine:frame'])) {
        return getNextBlock(nextSibling);
      }
      return nextSibling;
    }
    currentBlock = page.getParent(currentBlock);
  }
  return null;
}

/**
 *
 * @example
 * ```md
 * page
 * - frame
 *   - paragraph <- 5
 * - frame <- 4 (will be skipped)
 *  - paragraph <- 3
 *    - child <- 2
 *      - child <- 1
 *  - paragraph <- when invoked here, the traverse order will be above
 * ```
 *
 * NOTE: this method will skip the `affine:frame` and `affine:page` block
 */
export function getPreviousBlock(
  model: BaseBlockModel,
  map: Record<string, true> = {}
): BaseBlockModel | null {
  if (model.id in map) {
    throw new Error(
      "Can't get previous block! There's a loop in the block tree!"
    );
  }
  map[model.id] = true;

  const page = model.page;
  const parentBlock = page.getParent(model);
  if (!parentBlock) {
    return null;
  }
  const previousBlock = page.getPreviousSibling(model);
  if (!previousBlock) {
    if (matchFlavours(parentBlock, ['affine:frame', 'affine:page'])) {
      return getPreviousBlock(parentBlock);
    }
    return parentBlock;
  }
  if (previousBlock.children.length) {
    let lastChild = previousBlock.children[previousBlock.children.length - 1];
    while (lastChild.children.length) {
      lastChild = lastChild.children[lastChild.children.length - 1];
    }
    // Assume children is not possible to be `affine:frame` or `affine:page`
    return lastChild;
  }
  return previousBlock;
}

export function getDefaultPageBlock(model: BaseBlockModel) {
  assertExists(model.page.root);
  const page = document.querySelector(
    `[${ATTR}="${model.page.root.id}"]`
  ) as DefaultPageBlockComponent;
  return page;
}

export function getContainerByModel(model: BaseBlockModel) {
  assertExists(model.page.root);
  const page = document.querySelector(
    `[${ATTR}="${model.page.root.id}"]`
  ) as DefaultPageBlockComponent;
  const container = page.closest('editor-container');
  assertExists(container);
  return container;
}

export function getBlockElementByModel(model: BaseBlockModel) {
  assertExists(model.page.root);
  const page = document.querySelector(
    `[${ATTR}="${model.page.root.id}"]`
  ) as DefaultPageBlockComponent;
  if (!page) return null;

  if (model.id === model.page.root.id) {
    return page as HTMLElement;
  }

  const element = page.querySelector(`[${ATTR}="${model.id}"]`);
  return element as HTMLElement | null;
}

export function getStartModelBySelection() {
  const selection = window.getSelection() as Selection;
  if (selection.rangeCount === 0) {
    throw new Error("Can't get start model by selection, rangeCount is 0");
  }

  const range = selection.getRangeAt(0);
  const startContainer =
    range.startContainer instanceof Text
      ? (range.startContainer.parentElement as HTMLElement)
      : (range.startContainer as HTMLElement);

  const startComponent = startContainer.closest(`[${ATTR}]`) as ContainerBlock;
  const startModel = startComponent.model as BaseBlockModel;
  return startModel;
}

export function getRichTextByModel(model: BaseBlockModel) {
  const blockElement = getBlockElementByModel(model);
  const richText = blockElement?.querySelector('rich-text') as RichText;
  if (!richText) return null;
  return richText;
}

export function getModelsByRange(range: Range): BaseBlockModel[] {
  let commonAncestor = range.commonAncestorContainer as HTMLElement;
  if (commonAncestor.nodeType === Node.TEXT_NODE) {
    return [getStartModelBySelection()];
  }
  if (
    commonAncestor.attributes &&
    !commonAncestor.attributes.getNamedItem(ATTR)
  ) {
    const parentElement = commonAncestor.closest(`[${ATTR}]`)
      ?.parentElement as HTMLElement;
    if (parentElement != null) {
      commonAncestor = parentElement;
    }
  }
  const intersectedModels: BaseBlockModel[] = [];
  const blockElementArray = commonAncestor.querySelectorAll(`[${ATTR}]`);
  if (blockElementArray.length > 1) {
    blockElementArray.forEach(ele => {
      const block = ele as ContainerBlock;
      assertExists(block.model);
      const blockElement = getBlockElementByModel(block.model);
      const mainElement = matchFlavours(block.model, ['affine:page'])
        ? blockElement?.querySelector(
            '.affine-default-page-block-title-container'
          )
        : blockElement?.querySelector('rich-text');
      if (
        mainElement &&
        range.intersectsNode(mainElement) &&
        blockElement?.tagName !== 'AFFINE-FRAME'
      ) {
        intersectedModels.push(block.model);
      }
    });
    return intersectedModels;
  }
  return [getStartModelBySelection()];
}

export function getModelByElement(element: Element): BaseBlockModel {
  const containerBlock = element.closest(`[${ATTR}]`) as ContainerBlock;
  assertExists(containerBlock.model);
  return containerBlock.model;
}

function mergeRect(a: DOMRect, b: DOMRect) {
  return new DOMRect(
    Math.min(a.left, b.left),
    Math.min(a.top, b.top),
    Math.max(a.right, b.right) - Math.min(a.left, b.left),
    Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top)
  );
}

export function getDOMRectByLine(
  rectList: DOMRectList,
  lineType: 'first' | 'last'
) {
  const list = Array.from(rectList);

  if (lineType === 'first') {
    let flag = 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i].left < 0 && list[i].right < 0 && list[i].height === 1) break;
      flag = i;
    }
    const subList = list.slice(0, flag + 1);
    return subList.reduce(mergeRect);
  } else {
    let flag = list.length - 1;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].height === 0) break;
      flag = i;
    }
    const subList = list.slice(flag);
    return subList.reduce(mergeRect);
  }
}

export function getCurrentRange(selection = window.getSelection()) {
  // When called on an <iframe> that is not displayed (e.g., where display: none is set) Firefox will return null
  // See https://developer.mozilla.org/en-US/docs/Web/API/Window/getSelection for more details
  if (!selection) {
    throw new Error('Failed to get current range, selection is null');
  }
  // Before the user has clicked a freshly loaded page, the rangeCount is 0.
  // The rangeCount will usually be 1.
  // But scripting can be used to make the selection contain more than one range.
  // See https://developer.mozilla.org/en-US/docs/Web/API/Selection/rangeCount for more details.
  if (selection.rangeCount === 0) {
    throw new Error('Failed to get current range, rangeCount is 0');
  }
  if (selection.rangeCount > 1) {
    console.warn('getCurrentRange may be wrong, rangeCount > 1');
  }
  return selection.getRangeAt(0);
}

function textWithoutNode(parentNode: Node, currentNode: Node) {
  let text = '';
  for (let i = 0; i < parentNode.childNodes.length; i++) {
    const node = parentNode.childNodes[i];

    if (node !== currentNode || !currentNode.contains(node)) {
      // @ts-ignore
      text += node.textContent || node.innerText || '';
    } else {
      return text;
    }
  }
  return text;
}

export function getQuillIndexByNativeSelection(
  ele: Node | null | undefined,
  nodeOffset: number,
  isStart = true
) {
  if (
    ele instanceof Element &&
    ele.classList.contains('affine-default-page-block-title-container')
  ) {
    return (
      (isStart
        ? ele.querySelector('input')?.selectionStart
        : ele.querySelector('input')?.selectionEnd) || 0
    );
  }

  let offset = 0;
  let lastNode = ele;
  let selfAdded = false;
  while (
    ele &&
    // @ts-ignore
    (!lastNode?.getAttributeNode ||
      // @ts-ignore
      !lastNode.getAttributeNode('contenteditable'))
  ) {
    if (ele instanceof Element && ele.hasAttribute(ATTR)) {
      offset = 0;
      break;
    }
    if (!selfAdded) {
      selfAdded = true;
      offset += nodeOffset;
    } else {
      offset += textWithoutNode(ele, lastNode as Node).length;
    }
    lastNode = ele;
    ele = ele?.parentNode;
  }
  return offset;
}

/**
 * Get the specific text node and offset by the selected block.
 * The reverse implementation of {@link getQuillIndexByNativeSelection}
 * See also {@link getQuillIndexByNativeSelection}
 *
 * ```ts
 * const [startNode, startOffset] = getTextNodeBySelectedBlock(startBlock);
 * const [endNode, endOffset] = getTextNodeBySelectedBlock(endBlock);
 *
 * const range = new Range();
 * range.setStart(startNode, startOffset);
 * range.setEnd(endNode, endOffset);
 *
 * const selection = window.getSelection();
 * selection.removeAllRanges();
 * selection.addRange(range);
 * ```
 */
export function getTextNodeBySelectedBlock(selectedBlock: SelectedBlock) {
  const blockElement = getBlockById(selectedBlock.id);
  const offset = selectedBlock.startPos ?? selectedBlock.endPos ?? 0;
  if (!blockElement) {
    throw new Error(
      'Failed to get block element, block id: ' + selectedBlock.id
    );
  }
  const richText = blockElement.querySelector('rich-text');
  if (!richText) {
    throw new Error('Failed to get rich text element');
  }
  const quill = richText.quill;

  const [leaf, leafOffset]: [LeafBlot, number] = quill.getLeaf(offset);
  return [leaf.domNode, leafOffset] as const;
}

export function getAllBlocks() {
  const blocks = Array.from(document.querySelectorAll(`[${ATTR}]`));
  return blocks.filter(item => {
    return (
      item.tagName !== 'AFFINE-DEFAULT-PAGE' && item.tagName !== 'AFFINE-FRAME'
    );
  });
}

export function isInsideRichText(element: unknown): element is RichText {
  // Fool-proofing
  if (element instanceof Event) {
    throw new Error('Did you mean "event.target"?');
  }

  if (!element || !(element instanceof Element)) {
    return false;
  }
  const richText = element.closest('rich-text');
  return !!richText;
}

export function isTitleElement(
  element: unknown
): element is HTMLTextAreaElement | HTMLInputElement {
  return (
    (element instanceof HTMLTextAreaElement ||
      element instanceof HTMLInputElement) &&
    element.getAttribute('data-block-is-title') === 'true'
  );
}

export function isDatabaseInput(element: unknown): boolean {
  return (
    element instanceof HTMLElement &&
    element.getAttribute('data-block-is-database-input') === 'true'
  );
}

export function isCaptionElement(node: unknown): node is HTMLInputElement {
  if (!(node instanceof Element)) {
    return false;
  }
  return node.classList.contains('affine-embed-wrapper-caption');
}

export function getElementFromEventTarget(
  target: EventTarget | null
): Element | null {
  if (!target) return null;
  if (target instanceof Element) return target;
  if (target instanceof Node) target.parentElement;
  return null;
}
