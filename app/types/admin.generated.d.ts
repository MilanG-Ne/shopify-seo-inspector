/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types.js';

export type PopulateProductMutationVariables = AdminTypes.Exact<{
  product: AdminTypes.ProductCreateInput;
}>;


export type PopulateProductMutation = { productCreate?: AdminTypes.Maybe<{ product?: AdminTypes.Maybe<(
      Pick<AdminTypes.Product, 'id' | 'title' | 'handle' | 'status'>
      & { variants: { edges: Array<{ node: Pick<AdminTypes.ProductVariant, 'id' | 'price' | 'barcode' | 'createdAt'> }> } }
    )> }> };

export type ShopifyReactRouterTemplateUpdateVariantMutationVariables = AdminTypes.Exact<{
  productId: AdminTypes.Scalars['ID']['input'];
  variants: Array<AdminTypes.ProductVariantsBulkInput> | AdminTypes.ProductVariantsBulkInput;
}>;


export type ShopifyReactRouterTemplateUpdateVariantMutation = { productVariantsBulkUpdate?: AdminTypes.Maybe<{ productVariants?: AdminTypes.Maybe<Array<Pick<AdminTypes.ProductVariant, 'id' | 'price' | 'barcode' | 'createdAt'>>> }> };

export type CatalogProductsQueryVariables = AdminTypes.Exact<{
  first: AdminTypes.Scalars['Int']['input'];
  after?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type CatalogProductsQuery = { products: { pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'>, nodes: Array<(
      Pick<AdminTypes.Product, 'id' | 'title' | 'handle' | 'descriptionHtml'>
      & { seo: Pick<AdminTypes.Seo, 'title' | 'description'>, media: { nodes: Array<(
          Pick<AdminTypes.MediaImage, 'id' | 'alt'>
          & { image?: AdminTypes.Maybe<Pick<AdminTypes.Image, 'url'>> }
        )> } }
    )> } };

export type CatalogCollectionsQueryVariables = AdminTypes.Exact<{
  first: AdminTypes.Scalars['Int']['input'];
  after?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type CatalogCollectionsQuery = { collections: { pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'>, nodes: Array<(
      Pick<AdminTypes.Collection, 'id' | 'title' | 'handle' | 'descriptionHtml'>
      & { seo: Pick<AdminTypes.Seo, 'title' | 'description'>, productsCount?: AdminTypes.Maybe<Pick<AdminTypes.Count, 'count'>> }
    )> } };

export type ProductVariantMediaQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type ProductVariantMediaQuery = { product?: AdminTypes.Maybe<(
    Pick<AdminTypes.Product, 'id'>
    & { variants: { nodes: Array<{ selectedOptions: Array<Pick<AdminTypes.SelectedOption, 'name' | 'value'>>, media: { nodes: Array<Pick<AdminTypes.ExternalVideo, 'id'> | Pick<AdminTypes.MediaImage, 'id'> | Pick<AdminTypes.Model3d, 'id'> | Pick<AdminTypes.Video, 'id'>> } }> } }
  )> };

export type ProductSeoUpdateMutationVariables = AdminTypes.Exact<{
  product: AdminTypes.ProductUpdateInput;
}>;


export type ProductSeoUpdateMutation = { productUpdate?: AdminTypes.Maybe<{ product?: AdminTypes.Maybe<(
      Pick<AdminTypes.Product, 'id' | 'title'>
      & { seo: Pick<AdminTypes.Seo, 'title' | 'description'> }
    )>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type CollectionSeoUpdateMutationVariables = AdminTypes.Exact<{
  collection: AdminTypes.CollectionUpdateInput;
}>;


export type CollectionSeoUpdateMutation = { collectionUpdate?: AdminTypes.Maybe<{ collection?: AdminTypes.Maybe<(
      Pick<AdminTypes.Collection, 'id'>
      & { seo: Pick<AdminTypes.Seo, 'title' | 'description'> }
    )>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type ImageAltUpdateMutationVariables = AdminTypes.Exact<{
  files: Array<AdminTypes.FileUpdateInput> | AdminTypes.FileUpdateInput;
}>;


export type ImageAltUpdateMutation = { fileUpdate?: AdminTypes.Maybe<{ files?: AdminTypes.Maybe<Array<Pick<AdminTypes.ExternalVideo, 'id' | 'alt'> | Pick<AdminTypes.GenericFile, 'id' | 'alt'> | Pick<AdminTypes.MediaImage, 'id' | 'alt'> | Pick<AdminTypes.Model3d, 'id' | 'alt'> | Pick<AdminTypes.Video, 'id' | 'alt'>>>, userErrors: Array<Pick<AdminTypes.FilesUserError, 'field' | 'message' | 'code'>> }> };

interface GeneratedQueryTypes {
  "#graphql\n  query CatalogProducts($first: Int!, $after: String) {\n    products(first: $first, after: $after, query: \"status:active\", sortKey: TITLE) {\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      nodes {\n        id\n        title\n        handle\n        descriptionHtml\n        seo {\n          title\n          description\n        }\n        media(first: 25, query: \"media_type:IMAGE\") {\n          nodes {\n            ... on MediaImage {\n              id\n              alt\n              image {\n                url(transform: { maxWidth: 240, maxHeight: 240 })\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n": {return: CatalogProductsQuery, variables: CatalogProductsQueryVariables},
  "#graphql\n  query CatalogCollections($first: Int!, $after: String) {\n    collections(first: $first, after: $after, sortKey: TITLE) {\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      nodes {\n        id\n        title\n        handle\n        descriptionHtml\n        seo {\n          title\n          description\n        }\n        productsCount {\n          count\n        }\n      }\n    }\n  }\n": {return: CatalogCollectionsQuery, variables: CatalogCollectionsQueryVariables},
  "#graphql\n  query ProductVariantMedia($id: ID!) {\n    product(id: $id) {\n      id\n      variants(first: 100) {\n        nodes {\n          selectedOptions {\n            name\n            value\n          }\n          media(first: 5) {\n            nodes {\n              id\n            }\n          }\n        }\n      }\n    }\n  }\n": {return: ProductVariantMediaQuery, variables: ProductVariantMediaQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n      mutation populateProduct($product: ProductCreateInput!) {\n        productCreate(product: $product) {\n          product {\n            id\n            title\n            handle\n            status\n            variants(first: 10) {\n              edges {\n                node {\n                  id\n                  price\n                  barcode\n                  createdAt\n                }\n              }\n            }\n          }\n        }\n      }": {return: PopulateProductMutation, variables: PopulateProductMutationVariables},
  "#graphql\n    mutation shopifyReactRouterTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {\n      productVariantsBulkUpdate(productId: $productId, variants: $variants) {\n        productVariants {\n          id\n          price\n          barcode\n          createdAt\n        }\n      }\n    }": {return: ShopifyReactRouterTemplateUpdateVariantMutation, variables: ShopifyReactRouterTemplateUpdateVariantMutationVariables},
  "#graphql\n  mutation ProductSeoUpdate($product: ProductUpdateInput!) {\n    productUpdate(product: $product) {\n      product {\n        id\n        title\n        seo {\n          title\n          description\n        }\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: ProductSeoUpdateMutation, variables: ProductSeoUpdateMutationVariables},
  "#graphql\n  mutation CollectionSeoUpdate($collection: CollectionUpdateInput!) {\n    collectionUpdate(collection: $collection) {\n      collection {\n        id\n        seo {\n          title\n          description\n        }\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: CollectionSeoUpdateMutation, variables: CollectionSeoUpdateMutationVariables},
  "#graphql\n  mutation ImageAltUpdate($files: [FileUpdateInput!]!) {\n    fileUpdate(files: $files) {\n      files {\n        id\n        alt\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }\n": {return: ImageAltUpdateMutation, variables: ImageAltUpdateMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
