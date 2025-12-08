import { Result } from 'try';

export async function prompt(query: string, signal: AbortController['signal']): Promise<Result<string>> {
    // @ts-ignore
    const availability = await LanguageModel.availability({ languages: ["en"] });
    if (availability !== "available") {
        return Result.error("Language model not available");
    }
    const session = await LanguageModel.create({
        initialPrompts: [
            { role: 'system', content: 'You are a helpful and friendly assistant.' },
        ],
        signal,
    });
    return Result.try(() => session.prompt([{ role: 'user', content: query }]));
}