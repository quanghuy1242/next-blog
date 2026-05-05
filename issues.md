1. Why do you remove most of my access controll thing? can you explain why you do that? I need a reason and explaination why you do that instead of remvoing things on your own. Like the old ones is complicated as expected, like the ability to create api key, and scoped permission to assign permission to a factor among three (user, group, api key), abitlty to create model schema and tons of things there, YOU REMOVED ThEM ALL, I NEED EXPLAIN. And fix it yourself
2. Fix this error first when i click to /admin/authorization-spaces/5c0248e6-8ec6-49b2-bc24-cc1624d53a7d/access

 2026-05-05 11:56:58.354 [error] Error [ZodError]: [ 
  {
    "origin": "string",
    "code": "too_small",
    "minimum": 1,
    "inclusive": true,
    "path": [
      "entityId"
    ],
    "message": "Object ID is required"
  }
]
    at k (.next/server/chunks/ssr/_015a32e5._.js:1:2594)
    at async m (.next/server/chunks/ssr/_aa9d0b13._.js:1:7794)
    at async p (.next/server/chunks/ssr/_aa9d0b13._.js:2:2713)
    at async L (.next/server/chunks/ssr/_aa9d0b13._.js:2:7928) {
  digest: '2393575021'
}

3. Trusted client does not work and still required consent page {"code":"NO_CONSENT_PAGE_PROVIDED","message":"No consent page provided"}
4. When updating a client, I need to edit to toggle the trusted client on and off.
5. From next-blog, the time when hitting auther service is incredeably slow, can we put a cache there so It could hit faster?
6. For auther auth space page and resource server page, can you make sure all pages of them use shared components defined in the project? like checkbox, textbox, dropdown...
