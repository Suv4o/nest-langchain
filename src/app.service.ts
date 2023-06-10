import { Injectable } from '@nestjs/common';
import { OpenAI } from 'langchain/llms/openai';
import { PromptTemplate } from 'langchain/prompts';
import { LLMChain } from 'langchain/chains';
import { BufferMemory } from 'langchain/memory';
import { ConversationChain } from 'langchain/chains';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { HumanChatMessage, SystemChatMessage } from 'langchain/schema';

@Injectable()
export class AppService {
  async getHello() {
    const chat = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      temperature: 0,
    });

    const response = await chat.call([
      new HumanChatMessage(
        'Translate this sentence from English to French. I love programming.',
      ),
    ]);

    return response;

    /////////

    // const model = new OpenAI({
    //   openAIApiKey: process.env.OPENAI_API_KEY,
    //   temperature: 0.9,
    // });
    // const memory = new BufferMemory();
    // const template = 'What is a good name for a company that makes {product}?';
    // const prompt = new PromptTemplate({
    //   template: template,
    //   inputVariables: ['product'],
    // });
    // const chain = new LLMChain({ llm: model, prompt: prompt });
    // const chain = new ConversationChain({ llm: model, memory: memory });
    // const res1 = await chain.call({ input: "Hi! I'm Jim." });
    // console.log(res1);
    // const res2 = await chain.call({ input: "What's my name?" });
    // const res = await chain.call({ product: 'colorful socks' });
    // return res2;
  }
}
