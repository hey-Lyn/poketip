import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./ChatMarkdown.css";

function ChatMarkdown({ children }) {
  return (
    <div className="chatMarkdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren }) => (
            <a href={href} target="_blank" rel="noreferrer">{linkChildren}</a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default ChatMarkdown;
