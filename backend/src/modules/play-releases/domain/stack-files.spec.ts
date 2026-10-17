import { frames, likelyFiles } from "./stack-files";

const trace = `java.lang.NullPointerException: boom
\tat com.acme.shop.orders.OrdersAdapter.onBindViewHolder(OrdersAdapter.kt:87)
\tat androidx.recyclerview.widget.RecyclerView$Adapter.bindViewHolder(RecyclerView.java:7254)
\tat com.acme.shop.orders.OrdersFragment$render$1.invoke(OrdersFragment.kt:142)
\tat android.os.Handler.handleCallback(Handler.java:958)
\tat com.acme.core.Native.call(Unknown Source)`;

describe("stack files", () => {
  it("parses Java and Kotlin frames", () => {
    expect(frames(trace)[0]).toEqual({
      className: "com.acme.shop.orders.OrdersAdapter",
      method: "onBindViewHolder",
      file: "OrdersAdapter.kt",
      line: 87,
    });
    expect(frames(trace)).toHaveLength(5);
  });

  it("keeps the app's own files, most frequent first", () => {
    const other = trace.replace("OrdersAdapter.kt:87", "OrdersAdapter.kt:90");
    expect(likelyFiles([other, trace, other], "com.acme.shop")).toEqual([
      "com/acme/shop/orders/OrdersFragment.kt:142",
      "com/acme/shop/orders/OrdersAdapter.kt:90",
      "com/acme/shop/orders/OrdersAdapter.kt:87",
    ]);
  });

  it("returns nothing for traces outside the app", () => {
    expect(
      likelyFiles(
        ["\tat android.os.Looper.loop(Looper.java:1)"],
        "com.acme.shop",
      ),
    ).toEqual([]);
  });
});
