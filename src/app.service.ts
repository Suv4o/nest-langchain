import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { PromptTemplate } from 'langchain/prompts';
import { LLMChain } from 'langchain/chains';
import { ConversationSummaryMemory } from 'langchain/memory';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { CheerioWebBaseLoader } from 'langchain/document_loaders/web/cheerio';
import { DataSourceOptions } from 'typeorm';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { TypeORMVectorStore } from 'langchain/vectorstores/typeorm';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

@Injectable()
export class AppService {
  async getUrls(websiteUrl) {
    let links = [];
    let isLoaded = false;
    let uniqueLinks = [websiteUrl];
    const linksToVisit = [];
    const visitedLinks = [];
    await getLinksFromUrl(websiteUrl);
    async function loopThroughLinks(allLinks) {
      for (const link of allLinks) {
        const isVisited = visitedLinks?.find(
          (visitedLink) => visitedLink === link,
        );
        if (!isVisited) {
          visitedLinks.push(link);
          await getLinksFromUrl(link);
        }
      }
    }
    async function getLinksFromUrl(url) {
      links = [];
      const websiteHtml = await fetch(url).catch(() => {
        return;
      });
      if (!websiteHtml) {
        return;
      }
      const htmlData = await websiteHtml.text();
      const $ = cheerio.load(htmlData);
      const linkObjects = $('a');
      linkObjects.each((index, element) => {
        links.push($(element).attr('href'));
      });
      uniqueLinks = [...new Set(links)];
      uniqueLinks = uniqueLinks
        .map((link) => {
          if (
            link?.includes('mailto:') ||
            link?.includes('tel:') ||
            link?.includes('javascript:') ||
            link?.includes('?') ||
            link?.includes('=') ||
            link?.includes('#') ||
            link?.includes('@') ||
            !link
          ) {
            return;
          }
          if (link?.includes('http')) {
            return link.endsWith('/') ? link.slice(0, -1) : link;
          } else {
            const formattedLink = link.startsWith('/') ? link : '/' + link;
            return websiteUrl + formattedLink;
          }
        })
        .filter((link) => {
          if (link?.includes('http')) {
            return link?.includes('http') && link?.includes(websiteUrl);
          }
        });
      linksToVisit.push(...uniqueLinks);
      if (!isLoaded) {
        await loopThroughLinks(uniqueLinks);
        isLoaded = true;
      }
    }
    return [...new Set(linksToVisit)];
  }

  async getWebsiteContent(websiteUrl) {
    const args = {
      postgresConnectionOptions: {
        type: 'postgres',
        host: process.env.POSTGRES_HOST,
        port: Number(process.env.POSTGRES_PORT),
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
      } as DataSourceOptions,
      tableName: 'documents',
    };

    const typeormVectorStore = await TypeORMVectorStore.fromDataSource(
      new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'text-embedding-ada-002',
        stripNewLines: true,
      }),
      args,
    );

    await typeormVectorStore.ensureTableInDatabase();

    const websiteUrls = await this.getUrls(websiteUrl).catch(() => {
      return;
    });

    if (!websiteUrls || !websiteUrls?.length) {
      return {
        success: false,
      };
    }

    for (const url of websiteUrls) {
      const loader = new CheerioWebBaseLoader(url, {
        selector: 'body',
      });
      const docs = await loader?.load().catch(() => {
        return;
      });

      if (!docs || !docs?.length) {
        continue;
      }

      const { pageContent: content, metadata } = docs[0];
      const pageContent = content
        ?.trim()
        ?.replace(/['"{}]+/g, '')
        ?.replace(/[:]+/g, ':')
        ?.replace(/,+/g, ';');

      if (!pageContent) {
        continue;
      }

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 100,
      });

      const output = await splitter.createDocuments([pageContent]);

      if (!output || !output?.length) {
        continue;
      }

      const documents = [];

      for (const doc of output) {
        if (!doc?.pageContent) {
          continue;
        }
        documents.push({ pageContent: doc.pageContent, metadata });
      }

      if (!documents || !documents?.length) {
        continue;
      }

      await typeormVectorStore
        .addDocuments(documents.filter((document) => document))
        .catch(() => {
          return;
        });
    }
    return {
      success: true,
    };
  }

  async chat(body) {
    const { inputMessage, historySummary } = body;

    const args = {
      postgresConnectionOptions: {
        type: 'postgres',
        host: process.env.POSTGRES_HOST,
        port: Number(process.env.POSTGRES_PORT),
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
      } as DataSourceOptions,
      tableName: 'documents',
    };

    const typeormVectorStore = await TypeORMVectorStore.fromDataSource(
      new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'text-embedding-ada-002',
        stripNewLines: true,
      }),
      args,
    );

    await typeormVectorStore.ensureTableInDatabase();

    const results = await typeormVectorStore.similaritySearchWithScore(
      inputMessage,
      3,
    );

    const compiledResults = [];

    for (const result of results) {
      compiledResults.push(
        result[0].pageContent +
          '(WEBSITE URL SOURCE:' +
          result[0].metadata.source +
          ')\n\n',
      );
    }

    const context = compiledResults.join(' ');

    const memory = new ConversationSummaryMemory({
      memoryKey: 'chat_history',
      llm: new ChatOpenAI({
        modelName: 'gpt-3.5-turbo',
        temperature: 0,
        maxTokens: 3000,
      }),
    });

    if (historySummary) {
      await memory.saveContext(
        {
          input: '',
        },
        {
          output: historySummary,
        },
      );
    }

    const chat = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0,
    });

    const prompt = PromptTemplate.fromTemplate(`
      Your task is to assist users in finding information from a website based on their queries. You will be provided with context from the website to help you find the most relevant information. If you cannot find the answer, you should return a message stating that there are no results for the question. The findings should be separated by a new line, and each finding should have a website URL source to indicate where the relevant information came from. If a user asks for a link, provide the relevant link for that finding. Instead of adding "WEBSITE URL SOURCE," say "Here you can find more information about your question." For generic questions such as "Hi," "Hello," "How are you," "What's up," and similar, you must reply with generic answers and not look up any results in the context.
      Context: 
      ${context}
      Current conversation:
      {chat_history}
      Human: 
      {input}
      AI:`);
    const chain = new LLMChain({ llm: chat, prompt, memory });

    const response = await chain.call({
      input: inputMessage,
    });
    console.log(await memory.loadMemoryVariables({}));
    return response;

    ///////////
    // const memory = new ConversationSummaryMemory({
    //   memoryKey: 'chat_history',
    //   llm: new ChatOpenAI({
    //     modelName: 'gpt-3.5-turbo',
    //     temperature: 0,
    //     maxTokens: 2000,
    //   }),
    // });
    // await memory.saveContext(
    //   {
    //     input: `Hi, my name is Perry, what's up?\nMy favorite sport is basketball\n?My favorite food is pizza?`,
    //   },
    //   {
    //     output: `Perry introduces themselves to the AI and the AI greets them, explaining its limitations. The AI asks if there's anything specific Perry would like to talk about or ask. Perry shares that their favorite sport is basketball, and the AI responds with information about the sport's history and evolution, as well as asking if Perry has a favorite team or player. The human then shares that their favorite food is pizza, and the AI responds with interesting facts about the origin of pizza and asks if Perry has a favorite type or toppings.`,
    //   },
    // );
    // const chat = new ChatOpenAI({
    //   openAIApiKey: process.env.OPENAI_API_KEY,
    //   modelName: 'gpt-3.5-turbo',
    //   temperature: 0,
    // });
    // const prompt =
    //   PromptTemplate.fromTemplate(`The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.
    //   Current conversation:
    //   {chat_history}
    //   Human: {input}
    //   AI:`);
    // const chain = new LLMChain({ llm: chat, prompt, memory });
    // const response = await chain.call({ input: 'What is my favorite food?' });
    // console.log(await memory.loadMemoryVariables({}));
    // return response;
  }
}
