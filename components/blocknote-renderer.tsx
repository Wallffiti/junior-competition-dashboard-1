"use client"

import React from "react"

/**
 * BlockNote Renderer - Properly handles BlockNote JSON format
 * Based on BlockNote official documentation: https://www.blocknotejs.org/docs
 * 
 * BlockNote Structure:
 * - Content is an array of blocks
 * - Each block has: id, type, props (block properties), content (inline content)
 * - Inline content can be strings or array of {type: "text" | "link", text?, content?, href?, styles?}
 * - Links have content array with styled text items
 */

interface InlineContent {
  type: "text" | "link"
  text?: string
  content?: InlineContent[]
  href?: string
  styles?: {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    strike?: boolean
    code?: boolean
    textColor?: string
    backgroundColor?: string
  }
}

interface BlockNoteBlock {
  id: string
  type: string
  props?: Record<string, any>
  content?: string | InlineContent[]
  children?: BlockNoteBlock[]
}

interface BlockNoteRendererProps {
  content: any
  className?: string
}

export const BlockNoteRenderer: React.FC<BlockNoteRendererProps> = ({
  content,
  className = "",
}) => {
  if (!content) {
    return <div className={className}>No content available</div>
  }

  let blocks: BlockNoteBlock[] = []

  // Parse content if it's a string
  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content)
      blocks = Array.isArray(parsed) ? parsed : parsed.blocks || []
    } catch (e) {
      console.error("Failed to parse BlockNote content:", e)
      return <div className={className}>{content}</div>
    }
  } else if (Array.isArray(content)) {
    blocks = content
  } else if (content.blocks) {
    blocks = content.blocks
  }

  if (blocks.length === 0) {
    return <div className={className}>No content to display</div>
  }

  /**
   * Renders inline content (text with styles and links)
   * Properly handles BlockNote's link structure with content arrays
   */
  const renderInlineContent = (inlineContent: any): React.ReactNode => {
    if (!inlineContent) return null

    // If it's a simple string
    if (typeof inlineContent === "string") {
      return inlineContent
    }

    // If it's an array of inline elements
    if (Array.isArray(inlineContent)) {
      return inlineContent.map((item, idx) => {
        if (typeof item === "string") {
          return <React.Fragment key={idx}>{item}</React.Fragment>
        }

        if (!item || typeof item !== "object") {
          return null
        }

        // Handle text with styles
        if (item.type === "text") {
          let element: React.ReactNode = item.text || ""

          // Apply inline styles
          if (item.styles) {
            const { bold, italic, underline, strike, code, textColor, backgroundColor } = item.styles

            if (code) {
              element = (
                <code className="bg-gray-200 px-1 rounded text-sm font-mono">
                  {element}
                </code>
              )
            }
            if (bold) element = <strong>{element}</strong>
            if (italic) element = <em>{element}</em>
            if (underline) element = <u>{element}</u>
            if (strike) element = <s>{element}</s>

            const style: React.CSSProperties = {}
            if (textColor && textColor !== "default") {
              style.color = textColor
            }
            if (backgroundColor && backgroundColor !== "default") {
              style.backgroundColor = backgroundColor
            }

            if (Object.keys(style).length > 0) {
              element = <span style={style}>{element}</span>
            }
          }

          return <React.Fragment key={idx}>{element}</React.Fragment>
        }

        // Handle links - content is an array of styled text items
        if (item.type === "link") {
          return (
            <a
              key={idx}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {renderInlineContent(item.content)}
            </a>
          )
        }

        return null
      })
    }

    return null
  }

  /**
   * Renders a single block
   */
  const renderBlock = (block: BlockNoteBlock, index: number): React.ReactNode => {
    if (!block) return null

    const { id, type, props = {}, content: blockContent } = block

    try {
      switch (type) {
        // Paragraph
        case "paragraph":
          return (
            <p key={id || index} className="mb-4 leading-relaxed">
              {renderInlineContent(blockContent)}
            </p>
          )

        // Headings
        case "heading":
          const level = props.level || 1
          const headingClasses: Record<number, string> = {
            1: "text-4xl font-bold mb-6 mt-8",
            2: "text-3xl font-bold mb-5 mt-7",
            3: "text-2xl font-bold mb-4 mt-6",
            4: "text-xl font-bold mb-3 mt-5",
          }
          const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements
          const headingStyle: React.CSSProperties = {}
          if (props.textColor && props.textColor !== "default") {
            headingStyle.color = props.textColor
          }
          if (props.backgroundColor && props.backgroundColor !== "default") {
            headingStyle.backgroundColor = props.backgroundColor
          }

          return React.createElement(
            HeadingTag,
            {
              key: id || index,
              className: headingClasses[level] || "text-2xl font-bold mb-4",
              style: headingStyle,
            },
            renderInlineContent(blockContent)
          )

        // Lists - Bullet
        case "bulletListItem":
          return (
            <li key={id || index} className="mb-2 ml-4">
              {renderInlineContent(blockContent)}
            </li>
          )

        // Lists - Numbered
        case "numberedListItem":
          return (
            <li key={id || index} className="mb-2 ml-4">
              {renderInlineContent(blockContent)}
            </li>
          )

        // Lists - Checkbox
        case "checkListItem":
          const checked = props.checked || false
          return (
            <div key={id || index} className="flex items-center mb-2 ml-4">
              <input
                type="checkbox"
                checked={checked}
                disabled
                className="mr-2 w-4 h-4"
              />
              <span className={checked ? "line-through text-gray-500" : ""}>
                {renderInlineContent(blockContent)}
              </span>
            </div>
          )

        // Toggle List Item
        case "toggleListItem":
          return (
            <details key={id || index} className="mb-2 ml-4">
              <summary className="cursor-pointer font-semibold">
                {renderInlineContent(blockContent)}
              </summary>
            </details>
          )

        // Code Block
        case "codeBlock":
          const language = props.language || "javascript"
          return (
            <pre
              key={id || index}
              className="bg-gray-900 text-gray-100 p-4 rounded-lg mb-4 overflow-x-auto"
            >
              <code className={`language-${language} text-sm`}>
                {typeof blockContent === "string" ? blockContent : ""}
              </code>
            </pre>
          )

        // Quote
        case "quote":
          return (
            <blockquote
              key={id || index}
              className="border-l-4 border-gray-400 pl-4 py-2 mb-4 italic text-gray-700 bg-gray-50 rounded"
            >
              {renderInlineContent(blockContent)}
            </blockquote>
          )

        // Image
        case "image":
          const imgStyle: React.CSSProperties = {
            maxWidth: "100%",
            height: "auto",
          }
          // Use previewWidth from BlockNote if available
          if (props.previewWidth) {
            imgStyle.width = `${props.previewWidth}px`
            imgStyle.maxWidth = "100%"
          }
          return (
            <figure key={id || index} className="mb-6">
              <img
                src={props.url}
                alt={props.caption || "Image"}
                className="rounded-lg"
                style={imgStyle}
              />
              {props.caption && (
                <figcaption className="text-sm text-gray-600 mt-2 text-center">
                  {props.caption}
                </figcaption>
              )}
            </figure>
          )

        // Video - Properly embed YouTube and other video URLs
        case "video":
          return (
            <figure key={id || index} className="mb-6">
              {renderVideoEmbed(props.url)}
              {props.caption && (
                <figcaption className="text-sm text-gray-600 mt-2 text-center">
                  {props.caption}
                </figcaption>
              )}
            </figure>
          )

        // Audio
        case "audio":
          return (
            <figure key={id || index} className="mb-6">
              <audio
                controls
                className="w-full"
                src={props.url}
              />
              {props.caption && (
                <figcaption className="text-sm text-gray-600 mt-2 text-center">
                  {props.caption}
                </figcaption>
              )}
            </figure>
          )

        // File
        case "file":
          return (
            <a
              key={id || index}
              href={props.url}
              download
              className="inline-flex items-center mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              <span className="mr-2">📥</span>
              {props.name || "Download File"}
            </a>
          )

        // Table
        case "table":
          return (
            <div key={id || index} className="mb-6 overflow-x-auto">
              <table className="border-collapse border border-gray-300 w-full">
                <tbody>
                  {blockContent?.rows?.map((row: any, rowIdx: number) => (
                    <tr key={rowIdx} className="border border-gray-300">
                      {row.cells?.map((cell: any, cellIdx: number) => (
                        <td
                          key={cellIdx}
                          className="border border-gray-300 px-4 py-2"
                        >
                          {renderInlineContent(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )

        // Divider / Horizontal Rule
        case "divider":
        case "horizontalRule":
          return <hr key={id || index} className="my-6 border-t-2 border-gray-300" />

        default:
          console.warn(`Unsupported block type: ${type}`)
          return null
      }
    } catch (error) {
      console.error(`Error rendering block type ${type}:`, error, block)
      return null
    }
  }

  /**
   * Helper to render video embeds (YouTube, etc.)
   */
  const renderVideoEmbed = (url: string): React.ReactNode => {
    if (!url) return null

    // YouTube detection
    const youtubeMatch = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]+)/
    )
    if (youtubeMatch) {
      const videoId = youtubeMatch[1]
      return (
        <iframe
          width="100%"
          height="auto"
          style={{ aspectRatio: "16/9", minHeight: "300px" }}
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="rounded-lg"
        />
      )
    }

    // Vimeo detection
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
    if (vimeoMatch) {
      const videoId = vimeoMatch[1]
      return (
        <iframe
          width="100%"
          height="auto"
          style={{ aspectRatio: "16/9", minHeight: "300px" }}
          src={`https://player.vimeo.com/video/${videoId}`}
          title="Vimeo video"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="rounded-lg"
        />
      )
    }

    // Direct video file (mp4, webm, etc.)
    if (url.match(/\.(mp4|webm|ogg|mov)$/i)) {
      return (
        <video
          controls
          style={{ width: "100%", height: "auto" }}
          className="rounded-lg"
          src={url}
        />
      )
    }

    // Fallback: try to render as iframe or video
    return (
      <video
        controls
        style={{ width: "100%", height: "auto" }}
        className="rounded-lg"
        src={url}
      />
    )
  }

  // Group list items together
  const groupedBlocks: (BlockNoteBlock | BlockNoteBlock[])[] = []
  let currentList: BlockNoteBlock[] = []
  let currentListType: string | null = null

  blocks.forEach((block) => {
    const isListItem =
      block.type === "bulletListItem" ||
      block.type === "numberedListItem" ||
      block.type === "checkListItem"

    if (isListItem) {
      if (currentListType === null || currentListType === block.type) {
        currentListType = block.type
        currentList.push(block)
      } else {
        // Different list type, save current list and start new one
        if (currentList.length > 0) {
          groupedBlocks.push([...currentList])
        }
        currentList = [block]
        currentListType = block.type
      }
    } else {
      // Not a list item
      if (currentList.length > 0) {
        groupedBlocks.push([...currentList])
        currentList = []
        currentListType = null
      }
      groupedBlocks.push(block)
    }
  })

  // Don't forget the last list
  if (currentList.length > 0) {
    groupedBlocks.push([...currentList])
  }

  return (
    <div className={className}>
      {groupedBlocks.map((item, index) => {
        if (Array.isArray(item)) {
          // It's a list
          const listType = item[0]?.type
          const isBulletList = listType === "bulletListItem"
          const isNumberedList = listType === "numberedListItem"
          const isCheckList = listType === "checkListItem"
          const isToggleList = listType === "toggleListItem"

          if (isBulletList) {
            return (
              <ul
                key={`list-${index}`}
                className="list-disc mb-4"
              >
                {item.map((block, idx) => renderBlock(block, idx))}
              </ul>
            )
          } else if (isNumberedList) {
            return (
              <ol
                key={`list-${index}`}
                className="list-decimal mb-4"
              >
                {item.map((block, idx) => renderBlock(block, idx))}
              </ol>
            )
          } else if (isCheckList) {
            return (
              <div key={`list-${index}`} className="mb-4">
                {item.map((block, idx) => renderBlock(block, idx))}
              </div>
            )
          } else if (isToggleList) {
            return (
              <div key={`list-${index}`} className="mb-4 space-y-2">
                {item.map((block, idx) => renderBlock(block, idx))}
              </div>
            )
          }

          // Fallback
          return (
            <div key={`list-${index}`} className="mb-4">
              {item.map((block, idx) => renderBlock(block, idx))}
            </div>
          )
        } else {
          return renderBlock(item, index)
        }
      })}
    </div>
  )
}

export default BlockNoteRenderer
