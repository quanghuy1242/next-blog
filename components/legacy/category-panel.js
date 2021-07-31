import Category from './category';
import Title from './title';

export default function CategoryPanel({ categories = [] }) {
  return (
    <div>
      <Title text="Categories" />
      {categories.map((category) => (
        <Category
          name={category.name}
          description={category.description}
          image={category.image}
          slug={category.slug}
          key={category.slug}
        />
      ))}
    </div>
  );
}
