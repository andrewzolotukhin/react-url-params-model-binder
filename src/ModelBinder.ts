import { ParamBinder } from './ParamBinders/ParamBinder.js';

type ModelParseResult<T> = {
    model?: T;
    newParams?: URLSearchParams;
};

export class ModelBinder<TModel> {
    #paramBinders: ParamBinder<TModel, any>[] = [];

    public addParamBinder<TModelValue>(
        paramBinder: ParamBinder<TModel, TModelValue>
    ): this {
        if (!(paramBinder instanceof ParamBinder)) {
            throw new Error('paramBinder must be instance of BaseParamBinder');
        }

        const urlParamName = paramBinder.urlParamName;

        if (this.#paramBinders.some((pb) => pb.urlParamName === urlParamName)) {
            throw new Error(
                `paramBinder with urlParamName ${urlParamName} already exists`
            );
        }

        this.#paramBinders.push(paramBinder);
        return this;
    }

    public async getModelFromUrlParams(
        urlParams: URLSearchParams,
        model?: TModel
    ): Promise<ModelParseResult<TModel>> {
        if (!(urlParams instanceof URLSearchParams)) {
            throw new Error('urlParams must be instance of URLSearchParams');
        }

        if (typeof model !== 'object' || model === null) {
            model = {} as TModel;
        } else {
            model = structuredClone(model);
        }
        const newParams = new URLSearchParams(urlParams);
        let hasErrors = false;

        const urlParamsKeys = Array.from(urlParams.keys());
        const paramBindersKeys = this.#paramBinders.map(
            (pb) => pb.urlParamName
        );

        await Promise.all(
            paramBindersKeys
                .filter((key) => !urlParamsKeys.includes(key))
                .map(async (key) => {
                    const paramBinder = this.#paramBinders.find(
                        (pb) => pb.urlParamName === key
                    );
                    const defaultParamValue =
                        await paramBinder.getDefaultParamValue(urlParams);
                    await paramBinder.setToModel(model, defaultParamValue);
                })
        );

        await Promise.all(
            urlParamsKeys.map(async (key) => {
                const paramBinder = this.#paramBinders.find(
                    (pb) => pb.urlParamName === key
                );

                if (!paramBinder) {
                    return;
                }

                if (
                    !(await paramBinder.isUrlParamValid(
                        urlParams.get(key) as string,
                        urlParams
                    ))
                ) {
                    hasErrors = true;
                    newParams.delete(key);
                    return;
                }

                const parsedValue = await paramBinder.parseUrlParamValue(
                    urlParams.get(key) as string,
                    urlParams
                );

                paramBinder.setToModel(model, parsedValue);
            })
        );

        if (hasErrors) {
            return { newParams };
        }

        const consistencyCheckResults = await Promise.all(
            this.#paramBinders.map((pb) => pb.isModelConsistent(model))
        );

        if (consistencyCheckResults.some((id) => id === false)) {
            await Promise.all(
                this.#paramBinders.map(async (pb) => {
                    const defaultParamValue = await pb.getDefaultParamValue(
                        urlParams
                    );
                    newParams.set(pb.urlParamName, defaultParamValue);
                })
            );
            return { newParams };
        }
        return { model };
    }

    public async getUrlParamsFromModel(
        model: TModel,
        searchParams?: URLSearchParams
    ): Promise<URLSearchParams> {
        if (!model || typeof model !== 'object') {
            throw new Error('model must be a non-null object');
        }

        const urlParams =
            searchParams instanceof URLSearchParams
                ? searchParams
                : new URLSearchParams();
        await Promise.all(
            this.#paramBinders.map(async (pb) => {
                const urlParamValue = await pb.getUrlParamValue(model);
                const defaultParamValue = await pb.getDefaultParamValue(
                    urlParams
                );
                if (urlParamValue !== defaultParamValue) {
                    urlParams.set(pb.urlParamName, urlParamValue);
                }
            })
        );
        return urlParams;
    }
}
