"""
rag.py — SmartBot V2
Two modes:
  - Offline: answers from documents only
  - Online:  answers from documents + DuckDuckGo web search
"""

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda

from .database import get_vectorstore
from .config import LLM_MODEL


# ─────────────────────────────────────────────
# Offline prompt (documents only)
# ─────────────────────────────────────────────
OFFLINE_PROMPT = """You are SmartBot, an AI assistant for a banking and insurance application.

IMPORTANT RULES:
1. You MUST answer the user's question using ONLY the context documents provided below.
2. Read the context carefully — the answer IS in the documents. Look for tables, rows, and structured data.
3. If the context contains table data with "|" separators, parse it carefully to extract the relevant information.
4. Provide specific details: coverage amounts, coinsurance percentages, limits, conditions, and any exceptions mentioned.
5. Use bullet points for lists and keep answers clear and complete.
6. NEVER say "I don't have information" if the context documents contain relevant content — extract and present it.
7. NEVER say "based on the context" or "according to the documents" — just answer directly and confidently.

Context from documents:
{context}

Question: {question}

Answer (use the context above to answer thoroughly):"""


# ─────────────────────────────────────────────
# Online prompt (documents + web search)
# ─────────────────────────────────────────────
ONLINE_PROMPT = """You are SmartBot, a highly intelligent AI assistant with access to both company documents and live internet search results.

Your job is to give the most ACCURATE, UP-TO-DATE, and COMPLETE answers possible.

RULES:
- Combine information from BOTH the document context AND web search results.
- Prioritise web search results for current events, news, prices, and recent information.
- Prioritise document context for company-specific policies, procedures, and internal information.
- Clearly distinguish when information comes from recent web sources vs company documents.
- Give specific details, facts, figures, and dates.
- Never say "based on the provided context" — just answer directly and confidently.
- Format clearly: use **bold**, bullet points, numbered steps where helpful.
- If web results contain a source URL, mention it naturally in the answer.

COMPANY DOCUMENT CONTEXT:
{context}

LIVE WEB SEARCH RESULTS:
{web_results}

QUESTION:
{question}

ANSWER:"""


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
def _format_docs(docs):
    if not docs:
        return "No relevant documents found."
    parts = []
    for i, doc in enumerate(docs, 1):
        source = doc.metadata.get("source", "Unknown")
        page   = doc.metadata.get("page", "")
        info   = f" (page {page})" if page != "" else ""
        parts.append(f"[Doc {i}: {source}{info}]\n{doc.page_content}")
    return "\n\n---\n\n".join(parts)


def _web_search(query: str, max_results: int = 5) -> str:
    """Search DuckDuckGo and return formatted results string."""
    try:
        try:
            from ddgs import DDGS
        except ImportError:
            from duckduckgo_search import DDGS
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                title = r.get("title", "")
                body  = r.get("body",  "")
                href  = r.get("href",  "")
                results.append(f"• {title}\n  {body}\n  Source: {href}")
        if not results:
            return "No web results found."
        return "\n\n".join(results)
    except Exception as e:
        return f"Web search unavailable: {str(e)}"


def _get_llm(temperature: float = 0.1):
    from .config import GROQ_API_KEY
    if GROQ_API_KEY:
        try:
            from langchain_groq import ChatGroq
            return ChatGroq(
                api_key=GROQ_API_KEY,
                model=LLM_MODEL,
                temperature=temperature,
                max_tokens=1200,
            )
        except ImportError:
            print("[SmartBot] langchain-groq not installed")
    try:
        from langchain_ollama import OllamaLLM
        return OllamaLLM(model="llama3.2:1b", temperature=temperature)
    except Exception:
        from langchain_community.llms import Ollama
        return Ollama(model="llama3.2:1b", temperature=temperature)


# ─────────────────────────────────────────────
# Offline chain (documents only)
# ─────────────────────────────────────────────

def get_offline_chain(k: int = 6):
    llm    = _get_llm()
    prompt = PromptTemplate(
        input_variables=["context", "question"],
        template=OFFLINE_PROMPT
    )

    class SafeRetriever:
        def invoke(self, q):
            try:
                vectordb  = get_vectorstore()
                retriever = vectordb.as_retriever(
                    search_type="similarity",
                    search_kwargs={"k": k}
                )
                return retriever.invoke(q)
            except Exception as e:
                print(f"[SmartBot] Retriever error: {e}")
                return []

    def run_chain(question: str) -> str:
        docs    = SafeRetriever().invoke(question)
        context = _format_docs(docs) if docs else "No documents available."
        try:
            filled = prompt.format(context=context, question=question)
            result = llm.invoke(filled)
            if hasattr(result, 'content'):
                return result.content
            return str(result) if result else "I could not generate a response."
        except Exception as e:
            print(f"[SmartBot] LLM error: {e}")
            return f"Error: {str(e)}"

    return run_chain, SafeRetriever()


# ─────────────────────────────────────────────
# Online chain (documents + web search)
# ─────────────────────────────────────────────
def get_online_chain(k: int = 6):
    llm    = _get_llm(temperature=0.2)
    prompt = PromptTemplate(
        input_variables=["context", "web_results", "question"],
        template=ONLINE_PROMPT
    )

    class SafeRetriever:
        def invoke(self, q):
            try:
                vectordb  = get_vectorstore()
                retriever = vectordb.as_retriever(
                    search_type="similarity",
                    search_kwargs={"k": k}
                )
                return retriever.invoke(q)
            except Exception as e:
                print(f"[SmartBot] Retriever error: {e}")
                return []

    def run_online(question: str) -> str:
        try:
            # Get document context too
            docs = SafeRetriever().invoke(question)
            context = _format_docs(docs) if docs else "No documents available."
            web_results = _web_search(question)
            filled = prompt.format(
                context=context,
                web_results=web_results,
                question=question
            )
            result = llm.invoke(filled)
            if hasattr(result, 'content'):
                return result.content
            return str(result) if result else "I could not generate a response."
        except Exception as e:
            print(f"[SmartBot] Online chain error: {e}")
            return f"Error: {str(e)}"

    return run_online, SafeRetriever()


# ─────────────────────────────────────────────
# Unified entry point used by main.py
# ─────────────────────────────────────────────
def get_qa_chain(internet: bool = False, k: int = 8):
    """
    Returns (chain, retriever).
    internet=True  → uses DuckDuckGo + documents
    internet=False → uses documents only
    """
    if internet:
        return get_online_chain(k=k)
    else:
        return get_offline_chain(k=k)
