"use client";

import { useState } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

type Option = { value: string; label: string };
const ALL = "__coderise_all__";

export function StyledSelect({
  id,
  name,
  defaultValue,
  options,
}: {
  id: string;
  name: string;
  defaultValue: string;
  options: Option[];
}) {
  const [value, setValue] = useState(
    options.some((option) => option.value === defaultValue)
      ? defaultValue
      : options[0]?.value ?? "",
  );

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Select.Root
        value={value || ALL}
        onValueChange={(next) => setValue(next === ALL ? "" : next)}
      >
        <Select.Trigger
          id={id}
          className="styled-select-trigger"
          aria-labelledby={`${id}-label`}
          type="button"
        >
          <Select.Value />
          <Select.Icon className="styled-select-chevron">
            <ChevronDown size={14} aria-hidden="true" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="styled-select-menu"
            position="popper"
            align="start"
            sideOffset={6}
            collisionPadding={12}
          >
            <Select.ScrollUpButton className="styled-select-scroll">
              <ChevronUp size={14} aria-hidden="true" />
            </Select.ScrollUpButton>
            <Select.Viewport className="styled-select-viewport">
              {options.map((option) => (
                <Select.Item
                  key={option.value || ALL}
                  value={option.value || ALL}
                  className="styled-select-option"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="styled-select-check">
                    <Check size={14} aria-hidden="true" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton className="styled-select-scroll">
              <ChevronDown size={14} aria-hidden="true" />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </>
  );
}
