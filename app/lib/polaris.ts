/**
 * React 18 passes props to custom elements as attributes, so `checked={false}`
 * becomes `checked="false"`, and a present boolean attribute means true.
 * Use `flag(condition)` for Polaris boolean props: it drops the attribute when
 * the condition is false. (React 19 sets properties and won't need this.)
 */
export function flag(condition: boolean | undefined): true | undefined {
  return condition ? true : undefined;
}
