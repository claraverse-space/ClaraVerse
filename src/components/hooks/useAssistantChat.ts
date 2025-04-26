import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Message, Tool } from '../../db';
import type { ChatRole } from '../../utils';
import { StructuredToolService } from '../assistantLibrary/structuredToolService';

// Add any other imports needed (e.g., getAppropriateModel, checkModelImageSupport, etc.)

interface UseAssistantChatProps {
  client: any;
  selectedModel: string;
  db: any;
  modelSelectionConfig: any;
  tools: Tool[];
  useAllTools: boolean;
  selectedTool: Tool | null;
  images: any[];
  setImages: (imgs: any[]) => void;
  ragEnabled: boolean;
  temporaryDocs: any[];
  pythonPort: number | null;
  setSelectedModel: (model: string) => void;
  setChats: (chats: any[]) => void;
  activeChat: string | null;
  setActiveChat: (id: string | null) => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  executeToolImplementation: any;
  formatToolForOpenAI: any;
  getAppropriateModel: any;
  checkModelImageSupport: any;
  findImageSupportedModel: any;
  searchDocuments: any;
  useStructuredToolCalling?: boolean;
}

export function useAssistantChat({
  client,
  selectedModel,
  db,
  modelSelectionConfig,
  tools,
  useAllTools,
  selectedTool,
  images,
  setImages,
  ragEnabled,
  temporaryDocs,
  pythonPort,
  setSelectedModel,
  setChats,
  activeChat,
  setActiveChat,
  scrollToBottom,
  executeToolImplementation,
  formatToolForOpenAI,
  getAppropriateModel,
  checkModelImageSupport,
  findImageSupportedModel,
  searchDocuments,
  useStructuredToolCalling = false,
}: UseAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const getContextMessages = (messages: Message[], useTool: boolean = false): Message[] => {
    if (useTool) {
      return messages.slice(-1);
    }
    return messages.slice(-20); // MAX_CONTEXT_MESSAGES
  };

  const formatMessagesForModel = async (messages: Message[]): Promise<{ role: string; content: string }[]> => {
    const systemPrompt = await db.getSystemPrompt();
    const formattedMessages = [];
    if (systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: systemPrompt
      });
    }
    formattedMessages.push(
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    );
    return formattedMessages;
  };

  const handleSend = async () => {
    if (!input.trim() || !client || !selectedModel || isProcessing) return;
    const context = {
      hasImages: images.length > 0,
      hasTool: !!selectedTool || useAllTools,
      hasRag: ragEnabled || temporaryDocs.length > 0
    };
    const modelToUse = getAppropriateModel(modelSelectionConfig, selectedModel, context);
    let actualModelToUse = modelToUse;
    if (modelSelectionConfig.mode === 'manual' && images.length > 0 && !checkModelImageSupport(modelToUse)) {
      const imageModel = findImageSupportedModel();
      if (imageModel) {
        actualModelToUse = imageModel;
        setSelectedModel(imageModel);
      }
    }
    const originalModel = selectedModel;
    let currentChatId = activeChat;
    if (!currentChatId) {
      const chatName = input.length > 50 ? input.slice(0, 50) + '...' : input;
      currentChatId = await db.createChat(chatName);
      setActiveChat(currentChatId);
    } else {
      const currentChats = await db.getRecentChats();
      const thisChat = currentChats.find((c: any) => c.id === currentChatId);
      if (thisChat && thisChat.title === 'New Chat') {
        const newTitle = input.length > 50 ? input.slice(0, 50) + '...' : input;
        await db.updateChat(currentChatId, { title: newTitle });
        const updatedChats = await db.getRecentChats();
        setChats(updatedChats);
      }
    }
    const userMessage: Message = {
      id: uuidv4(),
      chat_id: currentChatId,
      content: input,
      role: 'user' as ChatRole,
      timestamp: Date.now(),
      tokens: 0,
      images: images.map((img: any) => img.preview)
    };
    await db.addMessage(
      currentChatId,
      userMessage.content,
      userMessage.role,
      0,
      userMessage.images
    );
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setImages([]);
    const assistantMessage: Message = {
      id: uuidv4(),
      chat_id: currentChatId,
      content: '',
      role: 'assistant' as ChatRole,
      timestamp: Date.now(),
      tokens: 0
    };
    try {
      setIsProcessing(true);
      const startTime = performance.now();
      setMessages((prev) => [...prev, assistantMessage]);
      const chatOptions: any = {
        temperature: 0.7,
        top_p: 0.9
      };
      if (selectedTool || useAllTools) {
        chatOptions.tools = useAllTools ? tools.filter((tool) => tool !== null) : selectedTool ? [selectedTool] : [];
      }
      if (images.length > 0) {
        try {
          if (client.isStreaming) {
            let responseContent = '';
            let responseTokens = 0;
            for await (const chunk of client.streamGenerateWithImages(
              actualModelToUse,
              input,
              images.map((img: any) => img.base64),
              chatOptions
            )) {
              if (chunk.response) {
                responseContent += chunk.response;
                responseTokens = chunk.eval_count || responseTokens;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id ? { ...msg, content: responseContent, tokens: responseTokens } : msg
                  )
                );
                scrollToBottom();
              }
            }
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id ? { ...msg, content: responseContent, tokens: responseTokens } : msg
              )
            );
            await db.addMessage(currentChatId, responseContent, 'assistant', responseTokens);
          } else {
            const response = await client.generateWithImages(
              actualModelToUse,
              input,
              images.map((img: any) => img.base64),
              chatOptions
            );
            const content = response.response || '';
            const tokens = response.eval_count || 0;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id ? { ...msg, content, tokens } : msg
              )
            );
            await db.addMessage(currentChatId, content, 'assistant', tokens);
          }
          if (modelSelectionConfig.mode === 'manual' && originalModel !== actualModelToUse) {
            setSelectedModel(originalModel);
          }
          await db.updateModelUsage(actualModelToUse, performance.now() - startTime);
          await db.updateUsage('response_time', performance.now() - startTime);
          return;
        } catch (error) {
          console.error('Image generation error:', error);
          throw error;
        }
      }
      const contextMessages = getContextMessages([...messages, userMessage], !!selectedTool);
      let userContentWithContext = userMessage.content;
      const formattedMessages: any[] = [];
      if ((temporaryDocs.length > 0 || ragEnabled) && pythonPort) {
        const results = await searchDocuments(input, pythonPort, temporaryDocs, ragEnabled);
        if (results && results.results && results.results.length > 0) {
          const contextFromSearch = results.results.map((r: any) => r.content).join('\n\n');
          if (client?.getConfig().type === 'openai') {
            formattedMessages.unshift({
              role: 'system',
              content: `Context from knowledge base:\n${contextFromSearch}\n\nUse this context to inform your responses when relevant, but do not explicitly mention that you're using this context unless asked.`
            });
          } else {
            userContentWithContext = `Context From the Doc:\n"${contextFromSearch}"\n\nUser's Query: ${userMessage.content}\n\nPlease use the above context to inform your response when relevant, but do not explicitly mention the provided context unless specifically asked.`;
          }
        }
      }
      const systemPrompt = await db.getSystemPrompt();
      if (systemPrompt) {
        formattedMessages.push({ role: 'system' as ChatRole, content: systemPrompt });
      }
      contextMessages.forEach((msg: Message, index: number) => {
        if (index === contextMessages.length - 1 && msg.role === 'user') {
          formattedMessages.push({
            role: 'user' as ChatRole,
            content: userContentWithContext
          });
        } else {
          formattedMessages.push({
            role: (msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'user') as ChatRole,
            content: msg.content
          });
        }
      });
      if (selectedTool) {
        const formattedTool = client.getConfig().type === 'openai' ? formatToolForOpenAI(selectedTool) : selectedTool;
        chatOptions.tools = [formattedTool];
      }
      try {
        // Use different tool calling approach based on feature flag
        if (client.getConfig().type === 'ollama' && useStructuredToolCalling && (selectedTool || useAllTools)) {
          // Use structured tool calling for Ollama
          console.log("Using structured tool calling for Ollama");
          
          const availableTools = useAllTools ? tools : selectedTool ? [selectedTool] : [];
          const structuredToolService = new StructuredToolService({
            client,
            tools: availableTools,
            model: actualModelToUse,
            executeToolImplementation
          });
          
          // Process with structured tool calling
          const result = await structuredToolService.processWithStructuredTools(
            formattedMessages,
            chatOptions
          );
          
          // Add all generated messages to the chat
          for (const msg of result.messages) {
            const dbMessage: Message = {
              id: uuidv4(),
              chat_id: currentChatId as string,
              content: msg.content,
              role: msg.role,
              timestamp: Date.now(),
              tokens: 0,
              name: msg.name
            };
            
            // Only update UI for the first and last messages
            if (msg === result.messages[0] || msg === result.messages[result.messages.length - 1]) {
              setMessages(prev => [...prev.slice(0, prev.length - 1), dbMessage]);
            }
            
            // Save all messages to the database
            await db.addMessage(
              currentChatId,
              dbMessage.content,
              dbMessage.role,
              0,
              undefined,
              dbMessage.name
            );
          }
          
          // Update final message with content and tokens
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMessage.id ? { ...msg, content: result.content, tokens: result.tokens } : msg
            )
          );
          
        } else if (client.getConfig().type === 'openai') {
          const response = await client.sendChatWithToolsPreserveFormat(
            actualModelToUse,
            formattedMessages,
            chatOptions,
            chatOptions.tools
          );
          if (response.choices && response.choices.length > 0) {
            const message = response.choices[0].message;
            if (message.tool_calls && message.tool_calls.length > 0) {
              const toolResults = [];
              for (const toolCall of message.tool_calls) {
                const toolArgs = JSON.parse(toolCall.function.arguments);
                const selectedTool = tools.find((t: any) => t.name === toolCall.function.name);
                if (!selectedTool) {
                  console.error(`Tool ${toolCall.function.name} not found`);
                  continue;
                }
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id ? { ...msg, content: `Clara is using tool - ${selectedTool.name}...` } : msg
                  )
                );
                let toolResult: any = await executeToolImplementation(selectedTool, toolArgs);
                toolResults.push({
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                  content: JSON.stringify(toolResult)
                });
              }
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessage.id ? { ...msg, content: `Clara is working on summarizing the results...` } : msg
                )
              );
              const messagesWithToolResults = [
                ...formattedMessages,
                {
                  role: 'assistant' as ChatRole,
                  content: '',
                  tool_calls: message.tool_calls
                },
                ...toolResults.map((result) => ({
                  role: 'tool' as ChatRole,
                  content: result.content,
                  tool_call_id: result.tool_call_id,
                  name: result.name
                }))
              ];
              const finalResponse = await client.sendChatWithToolsPreserveFormat(
                actualModelToUse,
                messagesWithToolResults,
                { temperature: 0.7, top_p: 0.9 }
              );
              const content = finalResponse.choices?.[0]?.message?.content || 'Error: No content received after tool execution';
              const tokens = finalResponse.usage?.total_tokens || 0;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessage.id ? { ...msg, content, tokens } : msg
                )
              );
              await db.addMessage(currentChatId, content, 'assistant', tokens);
            } else {
              const content = message.content || 'No response content';
              const tokens = response.usage?.total_tokens || 0;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessage.id ? { ...msg, content, tokens } : msg
                )
              );
              await db.addMessage(currentChatId, content, 'assistant', tokens);
            }
          }
        } else {
          // Original Ollama implementation
          let responseContent = '';
          let responseTokens = 0;
          if (client.isStreaming) {
            for await (const chunk of client.streamChat(actualModelToUse, formattedMessages, chatOptions)) {
              if (chunk.message?.content) {
                responseContent += chunk.message.content;
                responseTokens = chunk.eval_count || responseTokens;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id ? { ...msg, content: responseContent, tokens: responseTokens } : msg
                  )
                );
                scrollToBottom();
              }
            }
          } else {
            const response = await client.sendChat(actualModelToUse, formattedMessages, chatOptions);
            responseContent = response.message?.content || '';
            responseTokens = response.eval_count || 0;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id ? { ...msg, content: responseContent, tokens: responseTokens } : msg
              )
            );
          }
          await db.addMessage(currentChatId, responseContent, 'assistant', responseTokens);
        }
      } catch (error) {
        let errorContent;
        try {
          if (typeof error === 'object' && error !== null && 'message' in error) {
            try {
              const parsedError = JSON.parse((error as Error).message);
              errorContent = `Error Response:\n\`\`\`json\n${JSON.stringify(parsedError, null, 2)}\n\`\`\``;
            } catch (e) {
              errorContent = `Error: ${(error as Error).message}`;
            }
          } else {
            errorContent = `Error: ${String(error)}`;
          }
        } catch (e) {
          errorContent = `Error: ${String(error)}`;
        }
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? { ...msg, content: errorContent } : msg
          )
        );
        await db.addMessage(currentChatId, errorContent, 'assistant', 0);
      }
      const endTime = performance.now();
      const duration = endTime - startTime;
      await db.updateModelUsage(actualModelToUse, duration);
      await db.updateUsage('response_time', duration);
      scrollToBottom();
    } catch (error) {
      let errorContent;
      try {
        if (typeof error === 'object' && error !== null && 'message' in error) {
          try {
            const parsedError = JSON.parse((error as Error).message);
            errorContent = `Error Response:\n\`\`\`json\n${JSON.stringify(parsedError, null, 2)}\n\`\`\``;
          } catch (e) {
            errorContent = `Error: ${(error as Error).message}`;
          }
        } else {
          errorContent = `Error: ${String(error)}`;
        }
      } catch (e) {
        errorContent = `Error: ${String(error)}`;
      }
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessage.id ? { ...msg, content: errorContent } : msg
        )
      );
      await db.addMessage(currentChatId, errorContent, 'assistant', 0);
    } finally {
      setIsProcessing(false);
      // setSelectedTool(null); // Reset selected tool after use (if needed)
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex < 0 || !client || !selectedModel) return;
    const updatedMessage = {
      ...messages[messageIndex],
      content: newContent
    };
    setMessages((prev) => [...prev.slice(0, messageIndex), updatedMessage]);
    await db.updateMessage(messageId, {
      content: newContent
    });
    try {
      setIsProcessing(true);
      const startTime = performance.now();
      const contextMessages = getContextMessages([...messages.slice(0, messageIndex), updatedMessage]);
      const formattedMessages = await formatMessagesForModel(contextMessages);
      const context = {
        hasImages: contextMessages.some((msg) => msg.images && msg.images.length > 0),
        hasTool: false,
        hasRag: ragEnabled || temporaryDocs.length > 0
      };
      const modelToUse = getAppropriateModel(modelSelectionConfig, selectedModel, context);
      const assistantMessage: Message = {
        id: uuidv4(),
        chat_id: activeChat!,
        content: '',
        role: 'assistant',
        timestamp: Date.now(),
        tokens: 0
      };
      setMessages((prev) => [...prev.slice(0, messageIndex + 1), assistantMessage]);
      let responseContent = '';
      let responseTokens = 0;
      if (client.isStreaming) {
        for await (const chunk of client.streamChat(modelToUse, formattedMessages)) {
          if (chunk.message?.content) {
            responseContent += chunk.message.content;
            responseTokens = chunk.eval_count || responseTokens;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id ? { ...msg, content: responseContent, tokens: responseTokens } : msg
              )
            );
            scrollToBottom();
          }
        }
      } else {
        const response = await client.sendChat(modelToUse, formattedMessages);
        responseContent = response.message?.content || '';
        responseTokens = response.eval_count || 0;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? { ...msg, content: responseContent, tokens: responseTokens } : msg
          )
        );
      }
      await db.addMessage(activeChat!, responseContent, 'assistant', responseTokens);
      const endTime = performance.now();
      const duration = endTime - startTime;
      await db.updateModelUsage(modelToUse, duration);
      await db.updateUsage('response_time', duration);
    } catch (error: any) {
      const errorContent = error.message || 'An unexpected error occurred';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.role === 'assistant' ? { ...msg, content: `Error: ${errorContent}` } : msg
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendEdit = async (messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex < 0 || !client || !selectedModel || !activeChat) return;
    if (messages[messageIndex].content === newContent) {
      return;
    }
    try {
      setIsProcessing(true);
      const startTime = performance.now();
      const updatedMessage = {
        ...messages[messageIndex],
        content: newContent,
        timestamp: Date.now()
      };
      setMessages((prev) => [...prev.slice(0, messageIndex), updatedMessage]);
      try {
        await db.deleteMessage(messageId).catch((e: any) => {});
        await db.addMessage(
          activeChat,
          newContent,
          'user',
          updatedMessage.tokens || 0,
          updatedMessage.images
        );
      } catch (dbError) {}
      const assistantMessage: Message = {
        id: uuidv4(),
        chat_id: activeChat,
        content: '',
        role: 'assistant',
        timestamp: Date.now(),
        tokens: 0
      };
      setMessages((prev) => [...prev, assistantMessage]);
      const contextMessages = getContextMessages([...messages.slice(0, messageIndex), updatedMessage]);
      const formattedMessages = await formatMessagesForModel(contextMessages);
      const context = {
        hasImages: contextMessages.some((msg) => msg.images && msg.images.length > 0),
        hasTool: false,
        hasRag: ragEnabled || temporaryDocs.length > 0
      };
      const modelToUse = getAppropriateModel(modelSelectionConfig, selectedModel, context);
      let responseContent = '';
      let responseTokens = 0;
      if (client.isStreaming) {
        for await (const chunk of client.streamChat(modelToUse, formattedMessages)) {
          if (chunk.message?.content) {
            responseContent += chunk.message.content;
            responseTokens = chunk.eval_count || responseTokens;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id ? { ...msg, content: responseContent, tokens: responseTokens } : msg
              )
            );
            scrollToBottom();
          }
        }
      } else {
        const response = await client.sendChat(modelToUse, formattedMessages);
        responseContent = response.message?.content || '';
        responseTokens = response.eval_count || 0;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? { ...msg, content: responseContent, tokens: responseTokens } : msg
          )
        );
      }
      await db.addMessage(activeChat, responseContent, 'assistant', responseTokens);
      const endTime = performance.now();
      const duration = endTime - startTime;
      await db.updateModelUsage(modelToUse, duration);
      await db.updateUsage('response_time', duration);
    } catch (error: any) {
      const errorContent = error.message || 'An unexpected error occurred';
      const errorMessage: Message = {
        id: uuidv4(),
        chat_id: activeChat,
        content: `Error: ${errorContent}`,
        role: 'assistant',
        timestamp: Date.now(),
        tokens: 0
      };
      setMessages((prev) => [...prev.slice(0, messageIndex + 1), errorMessage]);
      await db.addMessage(activeChat, `Error: ${errorContent}`, 'assistant', 0);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryMessage = async (messageId: string) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex < 1 || !client || !selectedModel) return;
    try {
      setIsProcessing(true);
      const startTime = performance.now();
      const assistantMessage: Message = {
        id: messageId,
        chat_id: activeChat!,
        content: '',
        role: 'assistant',
        timestamp: Date.now(),
        tokens: 0
      };
      setMessages((prev) => prev.map((msg) => (msg.id === messageId ? assistantMessage : msg)));
      const contextMessages = getContextMessages([...messages.slice(0, messageIndex)]);
      const formattedMessages = await formatMessagesForModel(contextMessages);
      const context = {
        hasImages: contextMessages.some((msg) => msg.images && msg.images.length > 0),
        hasTool: false,
        hasRag: ragEnabled || temporaryDocs.length > 0
      };
      const modelToUse = getAppropriateModel(modelSelectionConfig, selectedModel, context);
      let responseContent = '';
      let responseTokens = 0;
      if (client.isStreaming) {
        for await (const chunk of client.streamChat(modelToUse, formattedMessages)) {
          if (chunk.message?.content) {
            responseContent += chunk.message.content;
            responseTokens = chunk.eval_count || responseTokens;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === messageId ? { ...msg, content: responseContent, tokens: responseTokens } : msg
              )
            );
            scrollToBottom();
          }
        }
      } else {
        const response = await client.sendChat(modelToUse, formattedMessages);
        responseContent = response.message?.content || '';
        responseTokens = response.eval_count || 0;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, content: responseContent, tokens: responseTokens } : msg
          )
        );
      }
      try {
        await db.updateMessage(messageId, {
          content: responseContent,
          tokens: responseTokens,
          timestamp: Date.now()
        });
      } catch (dbError) {}
      const endTime = performance.now();
      const duration = endTime - startTime;
      await db.updateModelUsage(modelToUse, duration);
      await db.updateUsage('response_time', duration);
    } catch (error: any) {
      const errorContent = error.message || 'An unexpected error occurred';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, content: `Error: ${errorContent}` } : msg
        )
      );
      try {
        await db.updateMessage(messageId, {
          content: `Error: ${errorContent}`,
          tokens: 0,
          timestamp: Date.now()
        });
      } catch (dbError) {}
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    messages,
    setMessages,
    input,
    setInput,
    isProcessing,
    handleSend,
    handleRetryMessage,
    handleEditMessage,
    handleSendEdit,
    getContextMessages,
    formatMessagesForModel,
  };
} 