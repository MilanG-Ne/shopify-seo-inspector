/**
 * Every Admin GraphQL operation the app runs. `npm run graphql-codegen`
 * reads the `#graphql` tags and generates typed variables and results into
 * `app/types/admin.generated.d.ts`, so `admin.graphql(OPERATION)` is typed
 * end to end.
 *
 * Page sizes keep each request's calculated cost well under the 1,000-point
 * single-query limit (roughly 25 products x 25 images).
 */

export const CATALOG_PRODUCTS_QUERY = `#graphql
  query CatalogProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, query: "status:active", sortKey: TITLE) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        descriptionHtml
        seo {
          title
          description
        }
        media(first: 25, query: "media_type:IMAGE") {
          nodes {
            ... on MediaImage {
              id
              alt
              image {
                url(transform: { maxWidth: 240, maxHeight: 240 })
              }
            }
          }
        }
      }
    }
  }
`;

export const CATALOG_COLLECTIONS_QUERY = `#graphql
  query CatalogCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after, sortKey: TITLE) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        descriptionHtml
        seo {
          title
          description
        }
        productsCount {
          count
        }
      }
    }
  }
`;

/** Variant context for drafting alt text, fetched only for selected products. */
export const PRODUCT_VARIANT_MEDIA_QUERY = `#graphql
  query ProductVariantMedia($id: ID!) {
    product(id: $id) {
      id
      variants(first: 100) {
        nodes {
          selectedOptions {
            name
            value
          }
          media(first: 5) {
            nodes {
              id
            }
          }
        }
      }
    }
  }
`;

export const PRODUCT_UPDATE_MUTATION = `#graphql
  mutation ProductSeoUpdate($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product {
        id
        title
        seo {
          title
          description
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const COLLECTION_UPDATE_MUTATION = `#graphql
  mutation CollectionSeoUpdate($collection: CollectionUpdateInput!) {
    collectionUpdate(collection: $collection) {
      collection {
        id
        seo {
          title
          description
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/** Alt text is set through `fileUpdate`; `productUpdateMedia` was removed in 2026-07. */
export const IMAGE_ALT_UPDATE_MUTATION = `#graphql
  mutation ImageAltUpdate($files: [FileUpdateInput!]!) {
    fileUpdate(files: $files) {
      files {
        id
        alt
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;
