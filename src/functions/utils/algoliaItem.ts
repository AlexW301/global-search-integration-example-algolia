import { Elements, ElementType, IContentItem } from "@kontent-ai/delivery-sdk";

export type AlgoliaItem = Readonly<{
  id: string;
  objectID: string;
  codename: string;
  name: string;
  language: string;
  type: string;
  slug: string;
  collection: string;
  content: readonly ContentBlock[];
  lastModified: string;
  includeInSearch: string;
  insightCategory?: string;
  experts?: any;
  lastNameStartsWith?: string;
}>;

type ContentBlock = Readonly<{
  id: string;
  codename: string;
  name: string;
  type: string;
  language: string;
  collection: string;
  parents: readonly string[];
  contents: string;
}>;

export const canConvertToAlgoliaItem = (expectedSlug: string) => (item: IContentItem): boolean =>
  !!item.elements[expectedSlug];

const createObjectId = (itemCodename: string, languageCodename: string) => `${itemCodename}_${languageCodename}`;

export const convertToAlgoliaItem =
  (allItems: ReadonlyMap<string, IContentItem>, expectedSlug: string) => (item: any): AlgoliaItem => ({
    id: item.system.id,
    type: item.system.type,
    codename: item.system.codename,
    collection: item.system.collection,
    name: item.system.name,
    language: item.system.language,
    objectID: createObjectId(item.system.codename, item.system.language),
    slug: item.elements.page_fields__slug.value,
    content: createRecordBlock(allItems, [], expectedSlug)(item),
    lastModified: item.system.lastModified,
    includeInSearch: item.elements.page_fields__include_in_search.value[0].name,
    ...(item.system.type === "insight" ? { insightCategory: item.elements.insight_category.value[0].name, experts: item.elements.authors.linkedItems.map((expert: any) => (expert.elements.full_name.value)) } : {}),
    ...(item.system.type === "expert" ? { lastNameStartsWith: item.elements.last_name.value[0] ? item.elements.last_name.value[0] : "", headshot: item.elements.headshot.value[0].url, title: item.elements.title.value } : {})
  });

const createRecordBlock =
  (allItems: ReadonlyMap<string, IContentItem>, parentCodenames: ReadonlyArray<string>, expectedSlug: string) =>
  (item: IContentItem): ReadonlyArray<ContentBlock> => {
    const content = Object.values(item.elements)
      .map(element => {
        switch (element.type) {
          case ElementType.Text:
            return element.value ?? "";
          case ElementType.RichText: {
            return element.value?.replace(/<[^>]*>?/gm, "").replace(/&nbsp;/g, " ").replace(/\n/g, " ") ?? "";
          }
          default:
            return "";
        }
      });

    const children = Object.values(item.elements)
      .flatMap(element => {
        switch (element.type) {
          case ElementType.RichText: {
            const typedElement = element as Elements.RichTextElement;
            return typedElement.linkedItems
              .filter(i => !parentCodenames.includes(i.system.codename))
              .filter(i => !canConvertToAlgoliaItem(expectedSlug)(i))
              .flatMap(createRecordBlock(allItems, [item.system.codename, ...parentCodenames], expectedSlug));
          }
          case ElementType.ModularContent: {
            const typedElement = element as Elements.LinkedItemsElement;
            return typedElement.linkedItems
              .filter(i => !parentCodenames.includes(i.system.codename))
              .filter(i => !canConvertToAlgoliaItem(expectedSlug)(i))
              .flatMap(createRecordBlock(allItems, [item.system.codename, ...parentCodenames], expectedSlug));
          }
          default:
            return [];
        }
      });

    const thisBlock: ContentBlock = {
      id: item.system.id,
      type: item.system.type,
      codename: item.system.codename,
      collection: item.system.collection,
      name: item.system.name,
      language: item.system.language,
      contents: content.join(" ").replace("\"", ""),
      parents: parentCodenames,
    };

    return [thisBlock, ...children];
  };
