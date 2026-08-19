/**
 * src/utils/jsx-env.d.ts
 *
 * 全局 JSX 命名空间兼容声明（frontend-phone-shell 自有，纯 type-only ambient）。
 *
 * 背景：@types/react@19 把 JSX 命名空间从全局移到 React 命名空间下（React.JSX），
 * 历史代码里 `JSX.Element` 这种全局引用在新版类型下报 "Cannot find namespace 'JSX'"。
 * 本声明把 React.JSX 重新导出为全局 JSX 命名空间，兼容各 App agent 既有写法，
 * 避免逐文件改 `React.JSX.Element`。此文件是 ambient declaration，零运行时影响。
 *
 * 注意：React 19 推荐写 React.JSX.Element；本兼容层仅为减少并行期改动面。
 * 长期可逐步迁移到 React.JSX 并删除本文件。
 */
import type { JSX as ReactJSX } from 'react'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  namespace JSX {
    type Element = ReactJSX.Element
    type ElementClass = ReactJSX.ElementClass
    type ElementAttributesProperty = ReactJSX.ElementAttributesProperty
    type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute
    type LibraryManagedAttributes<C, T> = ReactJSX.LibraryManagedAttributes<C, T>
    type IntrinsicAttributes = ReactJSX.IntrinsicAttributes
    type IntrinsicClassAttributes<T> = ReactJSX.IntrinsicClassAttributes<T>
    type IntrinsicElements = ReactJSX.IntrinsicElements
  }
}

export {}
