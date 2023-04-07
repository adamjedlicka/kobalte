/*!
 * Portions of this file are based on code from react-spectrum.
 * Apache License Version 2.0, Copyright 2020 Adobe.
 *
 * Credits to the React Spectrum team:
 * https://github.com/adobe/react-spectrum/blob/5c1920e50d4b2b80c826ca91aff55c97350bf9f9/packages/@react-aria/select/src/useSelect.ts
 */

import {
  access,
  createGenerateId,
  focusWithoutScrolling,
  mergeDefaultProps,
  OverrideComponentProps,
  ValidationState,
} from "@kobalte/utils";
import {
  Accessor,
  Component,
  createMemo,
  createSignal,
  createUniqueId,
  JSX,
  splitProps,
} from "solid-js";

import { createFormControl, FORM_CONTROL_PROP_NAMES, FormControlContext } from "../form-control";
import { createCollator } from "../i18n";
import { createListState, ListKeyboardDelegate } from "../list";
import { AsChildProp, Polymorphic } from "../polymorphic";
import { PopperRoot, PopperRootOptions } from "../popper";
import {
  CollectionNode,
  createDisclosureState,
  createFormResetListener,
  createPresence,
  createRegisterId,
} from "../primitives";
import {
  FocusStrategy,
  KeyboardDelegate,
  Selection,
  SelectionBehavior,
  SelectionMode,
} from "../selection";
import { SelectContext, SelectContextValue, SelectDataSet } from "./select-context";

export interface SelectBaseValueComponentProps<T> {
  /** The selected items. */
  items: CollectionNode<T>[];

  /** A function to remove an item from the selection. */
  remove: (item: CollectionNode<T>) => void;

  /** A function to clear the selection. */
  clear: () => void;
}

export interface SelectBaseItemComponentProps<T> {
  /** The item to render. */
  item: CollectionNode<T>;
}

export interface SelectBaseSectionComponentProps<T> {
  /** The section to render. */
  section: CollectionNode<T>;
}

export interface SelectBaseOptions<Option, OptGroup = never>
  extends Omit<PopperRootOptions, "anchorRef" | "contentRef" | "onCurrentPlacementChange">,
    AsChildProp {
  /** The controlled open state of the select. */
  open?: boolean;

  /**
   * The default open state when initially rendered.
   * Useful when you do not need to control the open state.
   */
  defaultOpen?: boolean;

  /** Event handler called when the open state of the select changes. */
  onOpenChange?: (isOpen: boolean) => void;

  /** The controlled value of the select. */
  value?: Iterable<string>;

  /**
   * The value of the select when initially rendered.
   * Useful when you do not need to control the value.
   */
  defaultValue?: Iterable<string>;

  /** Event handler called when the value changes. */
  onChange?: (value: Set<string>) => void;

  /** The content that will be rendered when no value or defaultValue is set. */
  placeholder?: JSX.Element;

  /** An array of options to display as the available options. */
  options?: Array<Option | OptGroup>;

  /** Property name or getter function to use as the value of an option. */
  optionValue?: keyof Option | ((option: Option) => string);

  /** Property name or getter function to use as the text value of an option for typeahead purpose. */
  optionTextValue?: keyof Option | ((option: Option) => string);

  /** Property name or getter function to use as the disabled flag of an option. */
  optionDisabled?: keyof Option | ((option: Option) => boolean);

  /** Property name or getter function that refers to the children options of an option group. */
  optionGroupChildren?: keyof OptGroup | ((optGroup: OptGroup) => Option[]);

  /** Function used to check if an option is an option group. */
  isOptionGroup?: (maybeOptGroup: OptGroup) => boolean;

  /** An optional keyboard delegate implementation for type to select, to override the default. */
  keyboardDelegate?: KeyboardDelegate;

  /** The type of selection that is allowed in the select. */
  selectionMode?: Exclude<SelectionMode, "none">;

  /** How multiple selection should behave in the select. */
  selectionBehavior?: SelectionBehavior;

  /** Whether onValueChange should fire even if the new set of keys is the same as the last. */
  allowDuplicateSelectionEvents?: boolean;

  /** Whether the select allows empty selection. */
  disallowEmptySelection?: boolean;

  /** Whether typeahead is disabled. */
  disallowTypeAhead?: boolean;

  /** Whether the select uses virtual scrolling. */
  virtualized?: boolean;

  /** The component to render inside `Select.Value`. */
  valueComponent?: Component<SelectBaseValueComponentProps<Option>>;

  /** When NOT virtualized, the component to render as an item in the `Select.Listbox`. */
  itemComponent?: Component<SelectBaseItemComponentProps<Option>>;

  /** When NOT virtualized, the component to render as a section in the `Select.Listbox`. */
  sectionComponent?: Component<SelectBaseSectionComponentProps<OptGroup>>;

  /**
   * Whether the select should be the only visible content for screen readers.
   * When set to `true`:
   * - interaction with outside elements will be disabled.
   * - scroll will be locked.
   * - focus will be locked inside the select content.
   * - elements outside the select content will not be visible for screen readers.
   */
  modal?: boolean;

  /**
   * Used to force mounting the select (portal, positioner and content) when more control is needed.
   * Useful when controlling animation with SolidJS animation libraries.
   */
  forceMount?: boolean;

  /**
   * A unique identifier for the component.
   * The id is used to generate id attributes for nested components.
   * If no id prop is provided, a generated id will be used.
   */
  id?: string;

  /**
   * The name of the select.
   * Submitted with its owning form as part of a name/value pair.
   */
  name?: string;

  /** Whether the select should display its "valid" or "invalid" visual styling. */
  validationState?: ValidationState;

  /** Whether the user must select an item before the owning form can be submitted. */
  required?: boolean;

  /** Whether the select is disabled. */
  disabled?: boolean;

  /** Whether the select is read only. */
  readOnly?: boolean;

  /** The children of the select. */
  children?: JSX.Element;
}

export interface SelectBaseProps<Option, OptGroup = never>
  extends OverrideComponentProps<"div", SelectBaseOptions<Option, OptGroup>>,
    AsChildProp {}

/**
 * Base component for a select, provide context for its children.
 * Used to build single and multi-select.
 */
export function SelectBase<Option, OptGroup = never>(props: SelectBaseProps<Option, OptGroup>) {
  const defaultId = `select-${createUniqueId()}`;

  props = mergeDefaultProps(
    {
      id: defaultId,
      selectionMode: "single",
      allowDuplicateSelectionEvents: true,
      disallowEmptySelection: props.selectionMode !== "multiple",
      gutter: 8,
      sameWidth: true,
      modal: false,
    },
    props
  );

  const [local, popperProps, formControlProps, others] = splitProps(
    props,
    [
      "valueComponent",
      "itemComponent",
      "sectionComponent",
      "open",
      "defaultOpen",
      "onOpenChange",
      "value",
      "defaultValue",
      "onChange",
      "placeholder",
      "options",
      "optionValue",
      "optionTextValue",
      "optionDisabled",
      "optionGroupChildren",
      "isOptionGroup",
      "keyboardDelegate",
      "allowDuplicateSelectionEvents",
      "disallowEmptySelection",
      "disallowTypeAhead",
      "selectionBehavior",
      "selectionMode",
      "virtualized",
      "modal",
      "forceMount",
    ],
    [
      "getAnchorRect",
      "placement",
      "gutter",
      "shift",
      "flip",
      "slide",
      "overlap",
      "sameWidth",
      "fitViewport",
      "hideWhenDetached",
      "detachedPadding",
      "arrowPadding",
      "overflowPadding",
    ],
    FORM_CONTROL_PROP_NAMES
  );

  const [triggerId, setTriggerId] = createSignal<string>();
  const [valueId, setValueId] = createSignal<string>();
  const [listboxId, setListboxId] = createSignal<string>();

  const [triggerRef, setTriggerRef] = createSignal<HTMLButtonElement>();
  const [contentRef, setContentRef] = createSignal<HTMLDivElement>();
  const [listboxRef, setListboxRef] = createSignal<HTMLUListElement>();

  const [listboxAriaLabelledBy, setListboxAriaLabelledBy] = createSignal<string>();
  const [focusStrategy, setFocusStrategy] = createSignal<FocusStrategy | boolean>(true);

  const disclosureState = createDisclosureState({
    open: () => local.open,
    defaultOpen: () => local.defaultOpen,
    onOpenChange: isOpen => local.onOpenChange?.(isOpen),
  });

  const contentPresence = createPresence(() => local.forceMount || disclosureState.isOpen());

  const focusListbox = () => {
    const listboxEl = listboxRef();

    if (listboxEl) {
      focusWithoutScrolling(listboxEl);
    }
  };

  const open = (focusStrategy: FocusStrategy | boolean) => {
    // Don't open if the collection is empty.
    if (listState.collection().getSize() <= 0) {
      return;
    }

    setFocusStrategy(focusStrategy);
    disclosureState.open();

    let focusedKey = listState.selectionManager().firstSelectedKey();

    if (focusedKey == null) {
      if (focusStrategy === "first") {
        focusedKey = listState.collection().getFirstKey();
      } else if (focusStrategy === "last") {
        focusedKey = listState.collection().getLastKey();
      }
    }

    focusListbox();
    listState.selectionManager().setFocused(true);
    listState.selectionManager().setFocusedKey(focusedKey);
  };

  const close = () => {
    disclosureState.close();

    listState.selectionManager().setFocused(false);
    listState.selectionManager().setFocusedKey(undefined);
  };

  const toggle = (focusStrategy: FocusStrategy | boolean) => {
    if (disclosureState.isOpen()) {
      close();
    } else {
      open(focusStrategy);
    }
  };

  const listState = createListState({
    selectedKeys: () => local.value,
    defaultSelectedKeys: () => local.defaultValue,
    onSelectionChange: keys => {
      local.onChange?.(keys);

      if (local.selectionMode === "single") {
        close();
      }
    },
    allowDuplicateSelectionEvents: () => access(local.allowDuplicateSelectionEvents),
    disallowEmptySelection: () => access(local.disallowEmptySelection),
    selectionBehavior: () => access(local.selectionBehavior),
    selectionMode: () => local.selectionMode,
    dataSource: () => local.options ?? [],
    getKey: () => local.optionValue as any,
    getTextValue: () => local.optionTextValue as any,
    getDisabled: () => local.optionDisabled as any,
    getSectionChildren: () => local.optionGroupChildren as any,
    getIsSection: () => local.isOptionGroup,
  });

  const { formControlContext } = createFormControl(formControlProps);

  createFormResetListener(triggerRef, () => {
    listState.selectionManager().setSelectedKeys(local.defaultValue ?? new Selection());
  });

  const collator = createCollator({ usage: "search", sensitivity: "base" });

  // By default, a KeyboardDelegate is provided which uses the DOM to query layout information (e.g. for page up/page down).
  const delegate = createMemo(() => {
    const keyboardDelegate = access(local.keyboardDelegate);

    if (keyboardDelegate) {
      return keyboardDelegate;
    }

    return new ListKeyboardDelegate(listState.collection, undefined, collator);
  });

  const selectedItems = createMemo(() => {
    return [...listState.selectionManager().selectedKeys()]
      .map(key => listState.collection().getItem(key))
      .filter(Boolean) as CollectionNode[];
  });

  const renderValue = () => {
    return local.valueComponent?.({
      get items() {
        return selectedItems();
      },
      remove: item => listState.selectionManager().toggleSelection(item.key),
      clear: () => listState.selectionManager().clearSelection(),
    });
  };

  const renderItem = (item: CollectionNode) => {
    return local.itemComponent?.({ item });
  };

  const renderSection = (section: CollectionNode) => {
    return local.sectionComponent?.({ section });
  };

  const dataset: Accessor<SelectDataSet> = createMemo(() => ({
    "data-expanded": disclosureState.isOpen() ? "" : undefined,
    "data-closed": !disclosureState.isOpen() ? "" : undefined,
  }));

  const context: SelectContextValue = {
    dataset,
    isOpen: disclosureState.isOpen,
    isDisabled: () => formControlContext.isDisabled() ?? false,
    isMultiple: () => access(local.selectionMode) === "multiple",
    isVirtualized: () => local.virtualized,
    isModal: () => local.modal ?? false,
    disallowTypeAhead: () => local.disallowTypeAhead ?? false,
    contentPresence,
    autoFocus: focusStrategy,
    triggerRef,
    listState: () => listState,
    keyboardDelegate: delegate,
    triggerId,
    valueId,
    listboxId,
    listboxAriaLabelledBy,
    setListboxAriaLabelledBy,
    setTriggerRef,
    setContentRef,
    setListboxRef,
    open,
    close,
    toggle,
    placeholder: () => local.placeholder,
    renderValue,
    renderItem,
    renderSection,
    generateId: createGenerateId(() => access(formControlProps.id)!),
    registerTriggerId: createRegisterId(setTriggerId),
    registerValueId: createRegisterId(setValueId),
    registerListboxId: createRegisterId(setListboxId),
  };

  return (
    <FormControlContext.Provider value={formControlContext}>
      <SelectContext.Provider value={context}>
        <PopperRoot anchorRef={triggerRef} contentRef={contentRef} {...popperProps}>
          <Polymorphic
            as="div"
            role="group"
            id={access(formControlProps.id)}
            {...formControlContext.dataset()}
            {...dataset()}
            {...others}
          />
        </PopperRoot>
      </SelectContext.Provider>
    </FormControlContext.Provider>
  );
}
