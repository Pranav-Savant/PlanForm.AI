import { useEffect, useState } from "react";
import { chatWithAssistant } from "../services/api";

function ChatbotWidget({ aiExplanation, recommendations, parsedLayout }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const firstMessage =
      "Hello! I am your structural assistant. Ask me about materials, tradeoffs, or calculations for this plan.";

    setMessages([{ sender: "bot", text: firstMessage }]);
  }, [aiExplanation, parsedLayout, recommendations]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const handleSend = async () => {
    const userText = input.trim();
    if (!userText || isLoading) return;

    const nextMessages = [...messages, { sender: "user", text: userText }];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    const parsedLayoutSummary = parsedLayout
      ? {
          rooms: parsedLayout.rooms,
          walls: parsedLayout.walls,
          totalArea: parsedLayout.totalArea,
          wallSegmentCount: parsedLayout.wallSegments?.length,
          roomPolygonCount: parsedLayout.roomPolygons?.length,
          doorCount: parsedLayout.doorsData?.length,
          windowCount: parsedLayout.windowsData?.length,
          openingCount: parsedLayout.openingsData?.length,
        }
      : undefined;

    const compactHistory = nextMessages.slice(-6).map((msg) => ({
      sender: msg.sender,
      text: typeof msg.text === "string" ? msg.text.slice(0, 500) : "",
    }));

    try {
      const data = await chatWithAssistant({
        message: userText,
        aiExplanation,
        recommendations,
        parsedLayout: parsedLayoutSummary,
        chatHistory: compactHistory,
      });

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: data?.reply || "I could not generate a response right now.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Unable to connect to AI service right now. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* FLOATING BUTTON */}

      <button
        onClick={toggleChat}
        className="
          fixed
          bottom-6
          right-6
          z-50
          bg-indigo-600
          hover:bg-indigo-700
          text-white
          w-14
          h-14
          rounded-full
          shadow-lg
          flex
          items-center
          justify-center
          text-xl
          transition
        "
      >
        💬
      </button>

      {/* CHAT WINDOW */}

      {isOpen && (
        <div
          className="
            fixed
            bottom-24
            right-6
            w-80
            h-[420px]
            bg-[#0E1117]
            border border-[#1E2330]
            rounded-xl
            shadow-2xl
            flex
            flex-col
            z-50
          "
        >
          {/* HEADER */}

          <div
            className="
              bg-indigo-600
              text-white
              px-4
              py-3
              rounded-t-xl
              flex
              justify-between
              items-center
            "
          >
            <span className="font-semibold">Model Assistant</span>

            <button
              onClick={toggleChat}
              className="text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          {/* MESSAGES */}

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`
                    px-3
                    py-2
                    rounded-lg
                    max-w-[70%]
                    text-sm
                    ${
                      msg.sender === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-700 text-gray-100"
                    }
                  `}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-lg max-w-[70%] text-sm bg-gray-700 text-gray-100">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {/* INPUT */}

          <div className="p-3 border-t border-[#1E2330] flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about materials or calculations..."
              disabled={isLoading}
              className="
                flex-1
                bg-[#151820]
                border border-[#1E2330]
                rounded-lg
                px-3
                py-2
                text-sm
                focus:outline-none
              "
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSend();
                }
              }}
            />

            <button
              onClick={handleSend}
              disabled={isLoading}
              className="
                bg-indigo-600
                hover:bg-indigo-700
                text-white
                px-4
                py-2
                rounded-lg
                text-sm
                disabled:opacity-60
              "
            >
              {isLoading ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default ChatbotWidget;
