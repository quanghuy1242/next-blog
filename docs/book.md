For chapter details, do:
```
query ChapterDetailBySlug($chapterSlug: String!) {
  Chapters(where: {slug: {equals: $chapterSlug}}, limit: 1) {
    docs {
      id
      title
      slug
      order
      chapterWordCount
      hasPassword
      content
      book {
        ... on Book {
          id
          title
          slug
          author
          description
          language
          visibility
          chapterCount
          totalWordCount
          cover {
            ... on Media {
              id
              url
              alt
              width
              height
            }
          }
        }
      }
    }
  }
  Homepage {
    header
  }
}
```

for book detail and toc loading, use:
```
query BookDetailWithChaptersByBookId($bookId: Int!, $bookRelationId: JSON!) {
  Books(
    where: {
      id: {
        equals: $bookId
      }
    }
    limit: 1
  ) {
    docs {
      id
      title
      slug
      author
      description
      language
      visibility
      chapterCount
      totalWordCount

      cover {
        ... on Media {
          id
          url
          alt
          width
          height
        }
      }
    }
  }

  Chapters(
    where: {
      book: {
        equals: $bookRelationId
      }
    }
    sort: "order"
    limit: 100
  ) {
    docs {
      id
      title
      slug
      order
      chapterWordCount
      hasPassword
    }
  }
}
```
